-- 自動タグ付けのための関数
CREATE OR REPLACE FUNCTION auto_tag_definitions() RETURNS void AS $$
DECLARE
    definitions_tag_id uuid;
BEGIN
    -- definitionsタグのIDを取得
    SELECT id INTO definitions_tag_id FROM tags WHERE name = 'definitions';
    
    -- 既存のdefinitionsタグを削除（再実行のため）
    DELETE FROM content_tags 
    WHERE tag_id = definitions_tag_id 
    AND created_by = 'auto_tagger';

    -- 定義規定の自動タグ付け
    INSERT INTO content_tags (
        tag_id,
        content_type,
        content_id,
        regulation_id,
        created_by,
        confidence,
        metadata
    )
    SELECT DISTINCT
        definitions_tag_id,
        'article',
        a.id,
        a.regulation_id,
        'auto_tagger',
        1.0 as confidence,
        jsonb_build_object(
            'matching_criteria', jsonb_build_array(
                'title',
                'content_pattern'
            )
        ) as metadata
    FROM articles a
    WHERE LOWER(a.title) LIKE '%definition%'
    AND (
        LOWER(a.content_full) LIKE '%means%' OR
        LOWER(a.content_full) LIKE '%refers to%'
    )
    AND EXISTS (
        SELECT 1 
        FROM regulations r 
        WHERE r.id = a.regulation_id
    );
END;
$$ LANGUAGE plpgsql;

-- 関数を実行
SELECT auto_tag_definitions();
