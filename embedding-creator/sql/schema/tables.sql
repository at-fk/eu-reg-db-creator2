CREATE EXTENSION IF NOT EXISTS vector;

-- 法域テーブル
CREATE TABLE jurisdictions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code text NOT NULL UNIQUE,           -- 'EU', 'JP', 'US' など
    name text NOT NULL,                  -- 'European Union', 'Japan', 'United States' など
    description text,                    -- 追加説明
    parent_jurisdiction_id uuid REFERENCES jurisdictions(id),  -- 階層構造用（EU加盟国など）
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 法令テーブル
CREATE TABLE regulations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,                    -- 識別コード (e.g., "EHDS", "GDPR")
    official_title text NOT NULL,          -- 正式名称
    short_title text NOT NULL,             -- 人間が読みやすい略称
    jurisdiction_id uuid REFERENCES jurisdictions(id), -- 法域
    document_date date,                    -- 制定日
    effective_date date,                   -- 施行日
    version text,                          -- バージョン情報
    status text,                           -- 状態（案、確定等）
    metadata jsonb,                        -- その他のメタデータ
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 前文テーブル
CREATE TABLE recitals (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    regulation_id uuid REFERENCES regulations(id),
    recital_number text NOT NULL,          -- 前文番号
    text text NOT NULL,                    -- 本文
    metadata jsonb,                        -- メタデータ
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Chapter テーブル
CREATE TABLE chapters (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    regulation_id uuid REFERENCES regulations(id),
    chapter_number text,                   -- "I", "II" など
    title text,
    order_index integer,                   -- 順序保持用
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Section テーブル
CREATE TABLE sections (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id uuid REFERENCES chapters(id),
    section_number text,                   -- "1", "2" など
    title text,
    order_index integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Articles テーブル（1対多の関係で定義）
CREATE TABLE articles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    regulation_id uuid REFERENCES regulations(id),
    chapter_id uuid REFERENCES chapters(id),    -- 必須
    section_id uuid REFERENCES sections(id),    -- オプショナル
    article_number text NOT NULL,
    title text,
    content_full text,
    order_index integer,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 条文パラグラフテーブル
CREATE TABLE paragraphs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id uuid REFERENCES articles(id),
    paragraph_number text,                -- パラグラフ番号
    chapeau text,                        -- 柱書き
    content_full text,                   -- パラグラフ全体（柱書き＋サブパラグラフ）
    metadata jsonb,                      -- メタデータ
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- -- サブパラグラフテーブル：使用しないことにした
-- CREATE TABLE subparagraphs (
--     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
--     paragraph_id uuid REFERENCES paragraphs(id),
--     subparagraph_id text,                -- "a", "b", "c" など
--     content text,                        -- サブパラグラフ本文
--     type text,                          -- "alphabetic", "numeric" など
--     order_index integer,                -- 順序保持用
--     created_at timestamptz DEFAULT now(),
--     updated_at timestamptz DEFAULT now()
-- );

CREATE TABLE paragraph_elements (
    id uuid PRIMARY KEY,
    paragraph_id uuid REFERENCES paragraphs(id),
    type text NOT NULL,       -- 'chapeau' or 'subparagraph'など
    element_id text,          -- subparagraph_id('a','b'など)があれば格納。chapeauならNULL可
    content text NOT NULL,    -- 本文
    order_index integer NOT NULL
);

-- 附属書テーブル
CREATE TABLE annexes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    regulation_id uuid REFERENCES regulations(id),
    annex_number text,                   -- 附属書番号
    title text,                         -- タイトル
    content jsonb,                      -- 構造化されたコンテンツ
    metadata jsonb,                     -- メタデータ
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 参照関係テーブルを再作成
DROP TABLE IF EXISTS legal_references CASCADE;

CREATE TABLE legal_references (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    regulation_id uuid REFERENCES regulations(id),  -- EHDSのID等を参照
    source_type text NOT NULL,           
    source_article text,                 
    source_paragraph text,               
    source_subparagraph text,            
    reference_type text NOT NULL,        
    context text,                        
    target_regulation text,              
    target_article text,                 
    target_paragraph text,               
    target_subparagraph text,            
    target_point text,                   
    target_type text,                    
    created_at timestamptz DEFAULT now(),
    model_used text                      
);

-- タグ/カテゴリテーブル
CREATE TABLE tags (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    description text,
    created_at timestamptz DEFAULT now()
);

-- タグ付けテーブル（汎用）
CREATE TABLE content_tags (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_id uuid REFERENCES tags(id),
    content_type text NOT NULL,          -- 'regulation', 'recital', 'article', 'paragraph'
    content_id uuid NOT NULL,
    regulation_id uuid REFERENCES regulations(id),  -- 所属する法令ID
    created_by text,                     -- タグ付けした人/システム
    confidence float,                    -- 自動タグ付けの場合の信頼度
    metadata jsonb,                      -- タグ付けに関する追加情報
    created_at timestamptz DEFAULT now(),
    
    -- 複合ユニーク制約
    UNIQUE (tag_id, content_type, content_id)
);

-- Embeddingテーブル
CREATE TABLE embeddings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type text NOT NULL,           -- 'chapter', 'section', 'recital', 'article' など
    source_id uuid NOT NULL,             -- 元テーブルのID
    regulation_id uuid NOT NULL,         -- 法令ID
    language_code text NOT NULL,         -- 'en', 'de', 'fr' など
    is_original boolean DEFAULT false,   -- 原文かどうか
    content_type text NOT NULL,          -- 'title_only', 'full_text', 'combined'
    input_text text NOT NULL,            -- 生成に使用したテキスト
    embedding vector(256),
    model_name text NOT NULL,            -- 'jina-embeddings-v3'
    model_version text NOT NULL,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    
    FOREIGN KEY (regulation_id) REFERENCES regulations(id)
); 