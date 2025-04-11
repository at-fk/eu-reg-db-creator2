-- ================================
-- search_articles.sql (修正版)
-- ================================

-- 既存の同名関数を一旦削除
DROP FUNCTION IF EXISTS public.search_articles(text,text,uuid,text,text);

-- 新規作成
CREATE OR REPLACE FUNCTION public.search_articles(
    search_query text,               -- ユーザー入力のキーワード(空の場合あり)
    search_mode text DEFAULT 'AND',  -- AND/ORフラグ
    regulation_id uuid DEFAULT NULL, -- 法令ID
    start_article text DEFAULT NULL, -- 開始条文 (数字+アルファベット混在可)
    end_article text DEFAULT NULL    -- 終了条文 (数字+アルファベット混在可)
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    base_condition text := 'TRUE';
    numeric_pattern text := '[^0-9]';
BEGIN
    -- 基本条件の構築
    -- 1. 法令ID条件
    IF regulation_id IS NOT NULL THEN
        base_condition := base_condition || format(' AND a.regulation_id = %L', regulation_id);
    END IF;

    -- 2. 条文範囲条件
    IF start_article IS NOT NULL AND end_article IS NOT NULL THEN
        base_condition := base_condition || format(
            ' AND CAST(regexp_replace(a.article_number, %L, '''') AS INTEGER) BETWEEN %s AND %s',
            numeric_pattern,
            CAST(regexp_replace(start_article, numeric_pattern, '') AS INTEGER),
            CAST(regexp_replace(end_article, numeric_pattern, '') AS INTEGER)
        );
    END IF;

    -- 3. キーワード条件
    IF search_query IS NOT NULL AND trim(search_query) <> '' THEN
        base_condition := base_condition || format(
            ' AND pe.content ILIKE ''%%'' || %L || ''%%''',
            trim(search_query)
        );
    END IF;

    -- メインクエリの実行
    RETURN QUERY EXECUTE format(
        'WITH all_elements AS (
            SELECT DISTINCT
                a.id,
                a.title,
                a.content_full AS content,
                a.article_number,
                a.regulation_id,
                p.id AS paragraph_id,
                p.paragraph_number,
                pe.type,
                pe.content AS element_content,
                pe.element_id,
                pe.order_index
            FROM articles a
            JOIN paragraphs p ON p.article_id = a.id
            JOIN paragraph_elements pe ON pe.paragraph_id = p.id
            WHERE %s
        ),
        elements_agg AS (
            SELECT
                ae.id,
                ae.title,
                ae.content,
                ae.article_number,
                ae.regulation_id,
                ae.paragraph_id,
                ae.paragraph_number,
                jsonb_agg(
                    jsonb_build_object(
                        ''type'', ae.type,
                        ''content'', ae.element_content,
                        ''element_id'', ae.element_id,
                        ''order_index'', ae.order_index
                    )
                    ORDER BY ae.order_index
                ) AS elements
            FROM all_elements ae
            GROUP BY
                ae.id,
                ae.title,
                ae.content,
                ae.article_number,
                ae.regulation_id,
                ae.paragraph_id,
                ae.paragraph_number
        ),
        paragraphs_agg AS (
            SELECT
                ea.id,
                ea.title,
                ea.content,
                ea.article_number,
                ea.regulation_id,
                jsonb_agg(
                    jsonb_build_object(
                        ''paragraph_id'', ea.paragraph_id,
                        ''paragraph_number'', ea.paragraph_number,
                        ''elements'', ea.elements
                    )
                    ORDER BY ea.paragraph_number
                ) AS paragraphs
            FROM elements_agg ea
            GROUP BY
                ea.id,
                ea.title,
                ea.content,
                ea.article_number,
                ea.regulation_id
        )
        SELECT jsonb_build_object(
            ''id'', pa.id,
            ''title'', pa.title,
            ''content'', pa.content,
            ''article_number'', pa.article_number,
            ''regulation_id'', pa.regulation_id,
            ''paragraphs'', pa.paragraphs
        ) AS result
        FROM paragraphs_agg pa
        ORDER BY CAST(regexp_replace(pa.article_number, %L, '''') AS INTEGER)',
        base_condition,
        numeric_pattern
    );
END;
$function$;