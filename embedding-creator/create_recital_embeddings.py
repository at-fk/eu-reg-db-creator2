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

def process_recitals(regulation_id: str):
    """Recitalsのembeddingを生成して保存"""
    try:
        # Recitalsの取得
        recitals = supabase.table('recitals')\
            .select('id, recital_number, text')\
            .eq('regulation_id', regulation_id)\
            .execute()
        
        for recital in recitals.data:
            # 既存のembeddingをチェック
            existing_embedding = supabase.table('embeddings')\
                .select('id')\
                .eq('source_type', 'recital')\
                .eq('source_id', recital['id'])\
                .execute()
            
            if not existing_embedding.data:
                # 前文番号とテキストを組み合わせたコンテンツを作成
                content = f"Recital {recital['recital_number']}: {recital['text']}"
                embedding = get_embedding(content)
                
                # embeddingsテーブルに保存
                supabase.table('embeddings').insert({
                    'source_type': 'recital',
                    'source_id': recital['id'],
                    'regulation_id': regulation_id,
                    'language_code': 'en',
                    'is_original': True,
                    'content_type': 'full_text',  # recitalsは全文を使用
                    'input_text': content,
                    'embedding': embedding,
                    'model_name': 'jina-embeddings-v3',
                    'model_version': 'base'
                }).execute()
                
                print(f"Created embedding for Recital {recital['recital_number']}")
                time.sleep(0.5)  # API制限を考慮した待機
                
    except Exception as e:
        print(f"Error processing recital embeddings: {e}")
        raise e

if __name__ == "__main__":
    # EHDSのregulation_idを取得
    result = supabase.table('regulations').select('id').eq('name', 'EHDS').execute()
    regulation_id = result.data[0]['id']
    
    process_recitals(regulation_id) 