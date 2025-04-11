-- 段落要素のマイグレーションSQL
BEGIN;

-- 新しいテーブルが存在しない場合のみ作成
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paragraph_element_type') THEN
        CREATE TYPE paragraph_element_type AS ENUM ('chapeau', 'subparagraph');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN 
        NULL;
END $$;

-- paragraph_elementsテーブルの作成
CREATE TABLE IF NOT EXISTS paragraph_elements (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    paragraph_id uuid REFERENCES paragraphs(id),
    type paragraph_element_type NOT NULL,
    element_id text,
    content text NOT NULL,
    order_index integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_paragraph_elements_paragraph_id ON paragraph_elements(paragraph_id);
CREATE INDEX IF NOT EXISTS idx_paragraph_elements_type ON paragraph_elements(type);

-- データ移行
-- subparagraphsテーブルからのデータ移行
INSERT INTO paragraph_elements (
    paragraph_id, 
    type, 
    element_id, 
    content, 
    order_index,
    created_at,
    updated_at
)
SELECT 
    paragraph_id,
    'subparagraph'::paragraph_element_type as type,
    subparagraph_id as element_id,
    content,
    order_index,
    created_at,
    updated_at
FROM subparagraphs
ON CONFLICT DO NOTHING;

-- paragraphsテーブルのchapeauデータの移行
INSERT INTO paragraph_elements (
    paragraph_id, 
    type, 
    element_id, 
    content, 
    order_index,
    created_at,
    updated_at
)
SELECT 
    id as paragraph_id,
    'chapeau'::paragraph_element_type as type,
    NULL as element_id,
    chapeau as content,
    0 as order_index,
    created_at,
    updated_at
FROM paragraphs
WHERE chapeau IS NOT NULL AND chapeau != ''
ON CONFLICT DO NOTHING;

-- 移行確認
DO $$
DECLARE
    chapeau_count integer;
    subparagraph_count integer;
    new_elements_count integer;
BEGIN
    SELECT COUNT(*) INTO chapeau_count
    FROM paragraphs
    WHERE chapeau IS NOT NULL AND chapeau != '';

    SELECT COUNT(*) INTO subparagraph_count
    FROM subparagraphs;

    SELECT COUNT(*) INTO new_elements_count
    FROM paragraph_elements;

    IF new_elements_count != (chapeau_count + subparagraph_count) THEN
        RAISE EXCEPTION 'データ移行の検証に失敗しました。期待値: %, 実際の値: %', 
            (chapeau_count + subparagraph_count), new_elements_count;
    END IF;
END $$;

COMMIT;

-- ロールバック用のコメントアウトされたコード
-- ROLLBACK; 