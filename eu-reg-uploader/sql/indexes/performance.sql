-- =============================================
-- パフォーマンス最適化用インデックス
-- =============================================

-- インデックス
CREATE INDEX idx_jurisdictions_code ON jurisdictions(code);
CREATE INDEX idx_regulations_jurisdiction ON regulations(jurisdiction_id);
CREATE INDEX idx_content_tags_content ON content_tags(content_type, content_id);
CREATE INDEX idx_content_tags_regulation ON content_tags(regulation_id);
CREATE INDEX idx_content_tags_tag ON content_tags(tag_id);

-- Embeddingインデックス
CREATE INDEX idx_embeddings_source ON embeddings(source_type, source_id);
CREATE INDEX idx_embeddings_regulation ON embeddings(regulation_id);
CREATE INDEX idx_embeddings_language ON embeddings(language_code, is_original);

-- ベクトル検索用インデックス
CREATE INDEX idx_embeddings_vector ON embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);

-- 全文検索用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_content_fulltext 
ON articles USING gin(to_tsvector('english', content_full));

-- 法令ID + 条文番号の複合インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_regulation_number 
ON articles (regulation_id, article_number text_pattern_ops);

-- 条文番号の数値比較用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_number_numeric 
ON articles ((CAST(REGEXP_REPLACE(article_number, '[^0-9]', '', 'g') AS INTEGER))); 