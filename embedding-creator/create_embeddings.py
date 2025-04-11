import os
import json
from supabase import create_client
import requests
from dotenv import load_dotenv
from typing import List, Dict, Any
import time

# .envファイルから環境変数を読み込む
load_dotenv()

# Supabase接続設定
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')

# Supabase クライアントの初期化
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Jina AI の設定
JINA_API_KEY = os.getenv('JINA_API_KEY')
EMBEDDING_API_URL = "https://api.jina.ai/v1/embeddings"

def get_embedding(text: str, max_retries: int = 3, retry_delay: int = 5) -> List[float]:
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
    
    for attempt in range(max_retries):
        try:
            response = requests.post(EMBEDDING_API_URL, headers=headers, json=data)
            if response.status_code == 200:
                return response.json()["data"][0]["embedding"]
            elif response.status_code == 502:  # Bad Gateway
                if attempt < max_retries - 1:  # まだリトライ可能
                    print(f"Bad Gateway error, retrying in {retry_delay} seconds... (attempt {attempt + 1}/{max_retries})")
                    time.sleep(retry_delay)
                    continue
            raise Exception(f"Error getting embedding (status code {response.status_code}): {response.text}")
        except Exception as e:
            if attempt < max_retries - 1:  # まだリトライ可能
                print(f"Error occurred, retrying in {retry_delay} seconds... (attempt {attempt + 1}/{max_retries})")
                print(f"Error details: {str(e)}")
                time.sleep(retry_delay)
                continue
            raise e  # 最後の試行でもエラーの場合は例外を投げる

def save_embedding(source_type: str, source_id: str, regulation_id: str, 
                  content_type: str, input_text: str, embedding: List[float]) -> None:
    """embeddingをデータベースに保存"""
    try:
        supabase.table('embeddings').insert({
            'source_type': source_type,
            'source_id': source_id,
            'regulation_id': regulation_id,
            'language_code': 'en',
            'is_original': True,
            'content_type': content_type,
            'input_text': input_text,
            'embedding': embedding,
            'model_name': 'jina-embeddings-v3',
            'model_version': 'base'
        }).execute()
        print(f"Saved embedding for {source_type} {source_id}")
    except Exception as e:
        print(f"Error saving embedding for {source_type} {source_id}: {e}")
        raise e

def check_existing_embedding(source_type: str, source_id: str, content_type: str = None) -> bool:
    """既存のembeddingの存在チェック"""
    query = supabase.table('embeddings')\
        .select('id')\
        .eq('source_type', source_type)\
        .eq('source_id', source_id)
    
    if content_type:
        query = query.eq('content_type', content_type)
    
    result = query.execute()
    return bool(result.data)

def get_context_info(article_data: Dict) -> str:
    """記事のコンテキスト情報（chapter, section, title）を取得"""
    try:
        # Chapter情報の取得
        chapter = supabase.table('chapters')\
            .select('chapter_number, title')\
            .eq('id', article_data['chapter_id'])\
            .single()\
            .execute()
        
        chapter_info = f"Chapter {chapter.data['chapter_number']}: {chapter.data['title']}"
        
        # Section情報の取得（存在する場合）
        section_info = ""
        if article_data['section_id']:
            section = supabase.table('sections')\
                .select('section_number, title')\
                .eq('id', article_data['section_id'])\
                .single()\
                .execute()
            if section.data:
                section_info = f"\nSection {section.data['section_number']}: {section.data['title']}"
        
        return f"{chapter_info}{section_info}"
    except Exception as e:
        print(f"Error getting context info: {e}")
        return ""

def process_recitals(regulation_id: str):
    """Recitalsのembeddingを生成（3件）"""
    try:
        recitals = supabase.table('recitals')\
            .select('id, recital_number, text')\
            .eq('regulation_id', regulation_id)\
            .limit(3)\
            .execute()
        
        for recital in recitals.data:
            if not check_existing_embedding('recital', recital['id']):
                content = f"Recital {recital['recital_number']}: {recital['text']}"
                embedding = get_embedding(content)
                save_embedding('recital', recital['id'], regulation_id, 'full_text', content, embedding)
                time.sleep(0.5)
    except Exception as e:
        print(f"Error processing recital embeddings: {e}")
        raise e

def process_paragraphs(regulation_id: str):
    """Paragraphsのembeddingを生成（3件）"""
    try:
        # regulation_idに紐づくarticlesのIDを取得
        articles = supabase.table('articles')\
            .select('id')\
            .eq('regulation_id', regulation_id)\
            .execute()
        
        article_ids = [article['id'] for article in articles.data]
        
        # 該当するarticlesに属するparagraphsを取得
        paragraphs = supabase.table('paragraphs')\
            .select('id, paragraph_number, content_full, article_id')\
            .in_('article_id', article_ids)\
            .limit(3)\
            .execute()
        
        for paragraph in paragraphs.data:
            if not check_existing_embedding('paragraph', paragraph['id']):
                # 記事番号の取得
                article = supabase.table('articles')\
                    .select('article_number')\
                    .eq('id', paragraph['article_id'])\
                    .single()\
                    .execute()
                
                # シンプルなコンテンツの作成
                full_content = f"Article {article.data['article_number']}, Paragraph {paragraph['paragraph_number']}\n\n{paragraph['content_full']}"
                
                embedding = get_embedding(full_content)
                save_embedding('paragraph', paragraph['id'], regulation_id, 'full_text', 
                             full_content, embedding)
                time.sleep(0.5)
    except Exception as e:
        print(f"Error processing paragraph embeddings: {e}")
        raise e

def process_definition_subparagraphs(regulation_id: str):
    """Article 2の定義に関するsubparagraphのembeddingを生成（3件）"""
    try:
        # Article 2のID取得
        article = supabase.table('articles')\
            .select('id')\
            .eq('regulation_id', regulation_id)\
            .eq('article_number', '2')\
            .single()\
            .execute()
        
        if not article.data:
            print("Article 2 not found")
            return
        
        # 該当するparagraphsのID取得
        paragraphs = supabase.table('paragraphs')\
            .select('id')\
            .eq('article_id', article.data['id'])\
            .execute()
        
        paragraph_ids = [p['id'] for p in paragraphs.data]
        
        # paragraph_elementsから該当するsubparagraphを取得
        elements = supabase.table('paragraph_elements')\
            .select('id, paragraph_id, element_id, content')\
            .in_('paragraph_id', paragraph_ids)\
            .eq('type', 'subparagraph')\
            .limit(3)\
            .execute()
        
        for element in elements.data:
            if not check_existing_embedding('subparagraph', element['id']):
                content = f"Definition {element['element_id']}: {element['content']}"
                embedding = get_embedding(content)
                save_embedding('subparagraph', element['id'], regulation_id, 'full_text', 
                             content, embedding)
                time.sleep(0.5)
    except Exception as e:
        print(f"Error processing definition subparagraphs: {e}")
        raise e

def process_articles(regulation_id: str):
    """Articlesのembeddingを生成（title_onlyとfull_text、それぞれ3件ずつ）"""
    try:
        articles = supabase.table('articles')\
            .select('id, article_number, title, content_full, chapter_id, section_id')\
            .eq('regulation_id', regulation_id)\
            .limit(3)\
            .execute()
        
        for article in articles.data:
            # コンテキスト情報の取得
            context_info = get_context_info(article)
            
            # title_only embedding
            if not check_existing_embedding('article', article['id'], 'title_only'):
                title_content = f"{context_info}\nArticle {article['article_number']}: {article['title']}"
                title_embedding = get_embedding(title_content)
                save_embedding('article', article['id'], regulation_id, 'title_only', 
                             title_content, title_embedding)
                time.sleep(0.5)
            
            # full_text embedding
            if not check_existing_embedding('article', article['id'], 'full_text'):
                full_content = f"{context_info}\nArticle {article['article_number']}: {article['title']}\n\n{article['content_full']}"
                full_embedding = get_embedding(full_content)
                save_embedding('article', article['id'], regulation_id, 'full_text', 
                             full_content, full_embedding)
                time.sleep(0.5)
    except Exception as e:
        print(f"Error processing article embeddings: {e}")
        raise e

def process_annexes(regulation_id: str):
    """Annexesのembeddingを生成（3件）"""
    try:
        annexes = supabase.table('annexes')\
            .select('id, annex_number, title, content')\
            .eq('regulation_id', regulation_id)\
            .limit(3)\
            .execute()
        
        for annex in annexes.data:
            if not check_existing_embedding('annex', annex['id']):
                # contentはJSONBなので、文字列に変換
                content = json.dumps(annex['content'])
                embedding = get_embedding(content)
                save_embedding('annex', annex['id'], regulation_id, 'full_text', 
                             content, embedding)
                time.sleep(0.5)
    except Exception as e:
        print(f"Error processing annex embeddings: {e}")
        raise e

def main():
    """メイン処理"""
    try:

        regulation_name = input("Enter the regulation name: ")
        # 指定されたregulation_nameに紐づくregulation_idを取得
        result = supabase.table('regulations')\
            .select('id')\
            .eq('name', regulation_name)\
            .single()\
            .execute()
        
        if not result.data:
            raise Exception(f"{regulation_name} regulation not found in database")
        
        regulation_id = result.data['id']
        print(f"Using {regulation_name} regulation_id: {regulation_id}")
        
        # 既存の指定されたregulation_nameのembeddingを削除
        print(f"\nDeleting existing {regulation_name} embeddings...")
        supabase.table('embeddings')\
            .delete()\
            .eq('regulation_id', regulation_id)\
            .execute()
        print(f"Existing {regulation_name} embeddings deleted")
        
        # 各種embeddingの生成（limit制限なし）
        print(f"\nProcessing recitals...")
        recitals = supabase.table('recitals')\
            .select('id, recital_number, text')\
            .eq('regulation_id', regulation_id)\
            .execute()
        
        for recital in recitals.data:
            content = f"Recital {recital['recital_number']}: {recital['text']}"
            embedding = get_embedding(content)
            save_embedding('recital', recital['id'], regulation_id, 'full_text', content, embedding)
            time.sleep(0.5)
        
        print("\nProcessing paragraphs...")
        articles = supabase.table('articles')\
            .select('id')\
            .eq('regulation_id', regulation_id)\
            .execute()
        
        article_ids = [article['id'] for article in articles.data]
        paragraphs = supabase.table('paragraphs')\
            .select('id, paragraph_number, content_full, article_id')\
            .in_('article_id', article_ids)\
            .execute()
        
        for paragraph in paragraphs.data:
            article = supabase.table('articles')\
                .select('article_number')\
                .eq('id', paragraph['article_id'])\
                .single()\
                .execute()
            
            full_content = f"Article {article.data['article_number']}, Paragraph {paragraph['paragraph_number']}\n\n{paragraph['content_full']}"
            embedding = get_embedding(full_content)
            save_embedding('paragraph', paragraph['id'], regulation_id, 'full_text', 
                         full_content, embedding)
            time.sleep(0.5)
        
        print("\nProcessing definition subparagraphs...")
        article = supabase.table('articles')\
            .select('id')\
            .eq('regulation_id', regulation_id)\
            .eq('article_number', '2')\
            .single()\
            .execute()
        
        if article.data:
            paragraphs = supabase.table('paragraphs')\
                .select('id')\
                .eq('article_id', article.data['id'])\
                .execute()
            
            paragraph_ids = [p['id'] for p in paragraphs.data]
            elements = supabase.table('paragraph_elements')\
                .select('id, paragraph_id, element_id, content')\
                .in_('paragraph_id', paragraph_ids)\
                .eq('type', 'subparagraph')\
                .execute()
            
            for element in elements.data:
                content = f"Definition {element['element_id']}: {element['content']}"
                embedding = get_embedding(content)
                save_embedding('subparagraph', element['id'], regulation_id, 'full_text', 
                             content, embedding)
                time.sleep(0.5)
        
        print("\nProcessing articles...")
        articles = supabase.table('articles')\
            .select('id, article_number, title, content_full, chapter_id, section_id')\
            .eq('regulation_id', regulation_id)\
            .execute()
        
        for article in articles.data:
            context_info = get_context_info(article)
            
            # title_only embedding
            title_content = f"{context_info}\nArticle {article['article_number']}: {article['title']}"
            title_embedding = get_embedding(title_content)
            save_embedding('article', article['id'], regulation_id, 'title_only', 
                         title_content, title_embedding)
            time.sleep(0.5)
            
            # full_text embedding
            full_content = f"{context_info}\nArticle {article['article_number']}: {article['title']}\n\n{article['content_full']}"
            full_embedding = get_embedding(full_content)
            save_embedding('article', article['id'], regulation_id, 'full_text', 
                         full_content, full_embedding)
            time.sleep(0.5)
        
        print("\nProcessing annexes...")
        annexes = supabase.table('annexes')\
            .select('id, annex_number, title, content')\
            .eq('regulation_id', regulation_id)\
            .execute()
        
        for annex in annexes.data:
            content = json.dumps(annex['content'])
            embedding = get_embedding(content)
            save_embedding('annex', annex['id'], regulation_id, 'full_text', 
                         content, embedding)
            time.sleep(0.5)
        
        print("\nAll embeddings have been created successfully!")
        
    except Exception as e:
        print(f"\nError in main process: {e}")
        raise e

if __name__ == "__main__":
    main() 