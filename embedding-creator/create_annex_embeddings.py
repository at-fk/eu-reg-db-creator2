import json
import os
from supabase import create_client
import requests
from dotenv import load_dotenv
from typing import List, Dict, Any
import time

# .envファイルから環境変数を読み込む
load_dotenv()

# Supabase クライアントの初期化
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_ANON_KEY')
)

# Jina AI の設定
JINA_API_KEY = os.getenv('JINA_API_KEY')
EMBEDDING_API_URL = "https://api.jina.ai/v1/embeddings"

def get_embedding(text: str) -> List[float]:
    """Jina AI APIを使用してテキストのembeddingを取得"""
    headers = {
        "Authorization": f"Bearer {JINA_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "jina-embeddings-v3",
        "task": "retrieval.passage",
        "late_chunking": False,
        "dimensions": "256",
        "embedding_type": "float",
        "input": [text]
    }
    
    response = requests.post(EMBEDDING_API_URL, headers=headers, json=data)
    if response.status_code == 200:
        return response.json()["data"][0]["embedding"]
    else:
        raise Exception(f"Error getting embedding: {response.text}")

def process_annex_content(annex: Dict[str, Any], regulation_id: str):
    """Annexの内容を処理してembeddingを生成"""
    try:
        # Annexをデータベースに保存し、IDを取得
        annex_data = {
            'regulation_id': regulation_id,
            'annex_number': annex['title'],
            'title': annex['content']['title'],
            'content': annex['content']
        }
        
        result = supabase.table('annexes').insert(annex_data).execute()
        annex_id = result.data[0]['id']
        
        # Annexのタイトルと内容を組み合わせてembeddingを生成
        title_content = f"{annex['title']}: {annex['content']['title']}"
        
        # 完全なコンテンツテキストを生成（カテゴリーやセクションの情報を含む）
        full_content = title_content
        if 'categories' in annex['content']:
            for category in annex['content']['categories']:
                full_content += f"\n\nCategory: {category['name']}\n{category['description']}"
                if 'items' in category:
                    for item in category['items']:
                        if isinstance(item, dict):
                            full_content += f"\n- {item['item']}"
                            if 'note' in item:
                                full_content += f" ({item['note']})"
                        else:
                            full_content += f"\n- {item}"
        
        if 'sections' in annex['content']:
            for section in annex['content']['sections']:
                full_content += f"\n\nSection {section['id']}: {section['name']}"
                if 'requirements' in section:
                    for req in section['requirements']:
                        full_content += f"\n{req['id']}: {req['text']}"
                        if 'items' in req:
                            for item in req['items']:
                                full_content += f"\n- {item}"
        
        # タイトルのみのembedding
        title_embedding = get_embedding(title_content)
        
        # 完全なコンテンツのembedding
        full_embedding = get_embedding(full_content)
        
        # embeddingsテーブルに保存（タイトルのみ）
        supabase.table('embeddings').insert({
            'source_type': 'annex',
            'source_id': annex_id,
            'regulation_id': regulation_id,
            'language_code': 'en',
            'is_original': True,
            'content_type': 'title_only',
            'input_text': title_content,
            'embedding': title_embedding,
            'model_name': 'jina-embeddings-v3',
            'model_version': 'base'
        }).execute()
        
        # embeddingsテーブルに保存（完全なコンテンツ）
        supabase.table('embeddings').insert({
            'source_type': 'annex',
            'source_id': annex_id,
            'regulation_id': regulation_id,
            'language_code': 'en',
            'is_original': True,
            'content_type': 'full_text',
            'input_text': full_content,
            'embedding': full_embedding,
            'model_name': 'jina-embeddings-v3',
            'model_version': 'base'
        }).execute()
        
        print(f"Created embeddings for {annex['title']}")
        time.sleep(1)  # API制限を考慮した待機
        
    except Exception as e:
        print(f"Error processing annex {annex['title']}: {e}")
        raise e

def process_annexes(json_file_path: str, regulation_id: str):
    """JSONファイルからAnnexデータを読み込んで処理"""
    try:
        with open(json_file_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            
        for annex in data['annexes']:
            process_annex_content(annex, regulation_id)
            
    except Exception as e:
        print(f"Error processing annexes: {e}")
        raise e

if __name__ == "__main__":
    # EHDSのregulation_idを取得
    result = supabase.table('regulations').select('id').eq('name', 'EHDS').execute()
    regulation_id = result.data[0]['id']
    
    # Annexes.jsonファイルのパスを指定
    json_file_path = 'Annex_par.json'
    
    process_annexes(json_file_path, regulation_id) 