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

def process_chapters_and_sections(regulation_id: str):
    """ChapterとSectionのembeddingを生成して保存"""
    try:
        # Chaptersの処理
        chapters = supabase.table('chapters')\
            .select('id, chapter_number, title')\
            .eq('regulation_id', regulation_id)\
            .execute()
        
        for chapter in chapters.data:
            # 既存のembeddingをチェック
            existing_embedding = supabase.table('embeddings')\
                .select('id')\
                .eq('source_type', 'chapter')\
                .eq('source_id', chapter['id'])\
                .execute()
            
            if not existing_embedding.data:
                content = f"Chapter {chapter['chapter_number']}: {chapter['title']}"
                embedding = get_embedding(content)
                
                # embeddingsテーブルに保存
                supabase.table('embeddings').insert({
                    'source_type': 'chapter',
                    'source_id': chapter['id'],
                    'regulation_id': regulation_id,
                    'language_code': 'en',
                    'is_original': True,
                    'content_type': 'title_only',
                    'input_text': content,
                    'embedding': embedding,
                    'model_name': 'jina-embeddings-v3',
                    'model_version': 'base'
                }).execute()
                
                print(f"Created embedding for Chapter {chapter['chapter_number']}")
                time.sleep(0.5)  # API制限を考慮した待機
        
        # Sectionsの処理
        sections = supabase.table('sections')\
            .select('id, section_number, title, chapter_id')\
            .execute()
        
        for section in sections.data:
            # chapter_idを使用して該当するregulation_idのsectionのみを処理
            chapter = supabase.table('chapters')\
                .select('regulation_id')\
                .eq('id', section['chapter_id'])\
                .eq('regulation_id', regulation_id)\
                .execute()
            
            if not chapter.data:
                continue
                
            # 既存のembeddingをチェック
            existing_embedding = supabase.table('embeddings')\
                .select('id')\
                .eq('source_type', 'section')\
                .eq('source_id', section['id'])\
                .execute()
            
            if not existing_embedding.data:
                content = f"Section {section['section_number']}: {section['title']}"
                embedding = get_embedding(content)
                
                # embeddingsテーブルに保存
                supabase.table('embeddings').insert({
                    'source_type': 'section',
                    'source_id': section['id'],
                    'regulation_id': regulation_id,
                    'language_code': 'en',
                    'is_original': True,
                    'content_type': 'title_only',
                    'input_text': content,
                    'embedding': embedding,
                    'model_name': 'jina-embeddings-v3',
                    'model_version': 'base'
                }).execute()
                
                print(f"Created embedding for Section {section['section_number']}")
                time.sleep(0.5)  # API制限を考慮した待機
                
    except Exception as e:
        print(f"Error processing embeddings: {e}")
        raise e

if __name__ == "__main__":
    # EHDSのregulation_idを取得
    result = supabase.table('regulations').select('id').eq('name', 'EHDS').execute()
    regulation_id = result.data[0]['id']
    
    process_chapters_and_sections(regulation_id) 