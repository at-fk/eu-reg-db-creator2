import os
from supabase import create_client
import requests
from dotenv import load_dotenv
from typing import List
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

def process_definitions(regulation_id: str):
    """Article 2のDefinitionsのサブパラグラフのembeddingを生成して保存"""
    try:
        # Article 2 (Definitions)を取得
        article = supabase.table('articles')\
            .select('id')\
            .eq('regulation_id', regulation_id)\
            .eq('article_number', '2')\
            .execute()
        
        if not article.data:
            raise Exception("Article 2 not found")
        
        article_id = article.data[0]['id']
        
        # Article 2に属するparagraphsを取得
        paragraphs = supabase.table('paragraphs')\
            .select('id')\
            .eq('article_id', article_id)\
            .execute()
        
        for paragraph in paragraphs.data:
            # 各paragraphのサブパラグラフを取得
            subparagraphs = supabase.table('subparagraphs')\
                .select('id, subparagraph_id, content')\
                .eq('paragraph_id', paragraph['id'])\
                .execute()
            
            for subparagraph in subparagraphs.data:
                # 既存のembeddingをチェック
                existing_embedding = supabase.table('embeddings')\
                    .select('id')\
                    .eq('source_type', 'subparagraph')\
                    .eq('source_id', subparagraph['id'])\
                    .execute()
                
                if not existing_embedding.data:
                    # 定義の形式でコンテンツを作成
                    content = f"Definition {subparagraph['subparagraph_id']}: {subparagraph['content']}"
                    
                    embedding = get_embedding(content)
                    
                    # embeddingsテーブルに保存
                    supabase.table('embeddings').insert({
                        'source_type': 'subparagraph',
                        'source_id': subparagraph['id'],
                        'regulation_id': regulation_id,
                        'language_code': 'en',
                        'is_original': True,
                        'content_type': 'definition',
                        'input_text': content,
                        'embedding': embedding,
                        'model_name': 'jina-embeddings-v3',
                        'model_version': 'base'
                    }).execute()
                    
                    print(f"Created embedding for Definition {subparagraph['subparagraph_id']}")
                    time.sleep(0.5)  # API制限を考慮した待機
                
    except Exception as e:
        print(f"Error processing definition embeddings: {e}")
        raise e

if __name__ == "__main__":
    # EHDSのregulation_idを取得
    result = supabase.table('regulations').select('id').eq('name', 'EHDS').execute()
    regulation_id = result.data[0]['id']
    
    process_definitions(regulation_id) 