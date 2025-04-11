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

def process_articles(regulation_id: str):
    """Articlesのタイトル情報のembeddingを生成して保存"""
    try:
        # Articlesの取得（chapter情報とsection情報も含める）
        articles = supabase.table('articles')\
            .select(
                'id, article_number, title, chapter_id, section_id'
            )\
            .eq('regulation_id', regulation_id)\
            .execute()
        
        for article in articles.data:
            # 既存のembeddingをチェック
            existing_embedding = supabase.table('embeddings')\
                .select('id')\
                .eq('source_type', 'article')\
                .eq('source_id', article['id'])\
                .eq('content_type', 'title_only')\
                .execute()
            
            if not existing_embedding.data:
                # Chapter情報の取得
                chapter = supabase.table('chapters')\
                    .select('chapter_number, title')\
                    .eq('id', article['chapter_id'])\
                    .execute()
                
                # Section情報の取得（存在する場合）
                section_info = ""
                if article['section_id']:
                    section = supabase.table('sections')\
                        .select('section_number, title')\
                        .eq('id', article['section_id'])\
                        .execute()
                    if section.data:
                        section_info = f", Section {section.data[0]['section_number']}: {section.data[0]['title']}"
                
                # コンテキストを含むタイトル情報を作成
                content = f"Chapter {chapter.data[0]['chapter_number']}: {chapter.data[0]['title']}{section_info}, Article {article['article_number']}: {article['title']}"
                
                embedding = get_embedding(content)
                
                # embeddingsテーブルに保存
                supabase.table('embeddings').insert({
                    'source_type': 'article',
                    'source_id': article['id'],
                    'regulation_id': regulation_id,
                    'language_code': 'en',
                    'is_original': True,
                    'content_type': 'title_only',
                    'input_text': content,
                    'embedding': embedding,
                    'model_name': 'jina-embeddings-v3',
                    'model_version': 'base'
                }).execute()
                
                print(f"Created embedding for Article {article['article_number']}")
                time.sleep(0.5)  # API制限を考慮した待機
                
    except Exception as e:
        print(f"Error processing article embeddings: {e}")
        raise e

if __name__ == "__main__":
    # EHDSのregulation_idを取得
    result = supabase.table('regulations').select('id').eq('name', 'EHDS').execute()
    regulation_id = result.data[0]['id']
    
    process_articles(regulation_id) 