-- メイン検索関数
DROP FUNCTION IF EXISTS match_articles(vector,double precision,integer,uuid[],text,text,text,text);
DROP FUNCTION IF EXISTS match_articles(vector,float,int,uuid[]);
DROP FUNCTION IF EXISTS match_articles(vector,float,int,uuid[],text,text);
DROP FUNCTION IF EXISTS match_articles(vector,float,int,uuid[],text,text,text);
DROP FUNCTION IF EXISTS match_articles(vector,float,int,text[],text,text,text,text);
DROP FUNCTION IF EXISTS match_articles(vector,double precision,integer,text[],text,text,text);

-- メイン検索関数
CREATE OR REPLACE FUNCTION match_articles(
    query_embedding vector(256),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    regulation_filters text[] DEFAULT '{}'::text[],
    search_level text DEFAULT 'article',
    start_article text DEFAULT NULL,
    end_article text DEFAULT NULL
) RETURNS TABLE (
    id uuid,
    title text,
    content text,
    article_number text,
    regulation_id uuid,
    regulation jsonb,
    chapter jsonb,
    similarity_percentage double precision,
    paragraphs jsonb,
    debug_info jsonb  -- デバッグ情報
) LANGUAGE plpgsql AS $$
DECLARE
    debug jsonb;
    article_numbers text[];
    article_number_condition text;
BEGIN
    -- 記事番号の検証と処理
    IF start_article IS NOT NULL THEN
        -- カンマ区切りの条文番号を配列に分割
        article_numbers := string_to_array(regexp_replace(start_article, '\s+', '', 'g'), ',');
        
        -- 各条文番号の形式を検証
        FOR i IN 1..array_length(article_numbers, 1) LOOP
            IF NOT article_numbers[i] ~ '^[0-9]+[a-zA-Z-]*$' THEN
                RAISE EXCEPTION '条文番号の形式が正しくありません: %', article_numbers[i];
            END IF;
        END LOOP;
    END IF;
    
    IF end_article IS NOT NULL AND NOT end_article ~ '^[0-9]+[a-zA-Z-]*$' THEN
        RAISE EXCEPTION '条文番号の形式が正しくありません: %', end_article;
    END IF;

    -- Build article number condition
    IF start_article IS NOT NULL THEN
        IF end_article IS NULL THEN
            -- 特定の条文番号のみを検索
            article_number_condition := format(
                'a.article_number = ANY(%L)',
                article_numbers
            );
        ELSE
            -- 範囲検索
            article_number_condition := format(
                'CAST(REGEXP_REPLACE(a.article_number, ''[^0-9]'', '''', ''g'') AS INTEGER) BETWEEN 
                CAST(REGEXP_REPLACE(%L, ''[^0-9]'', '''', ''g'') AS INTEGER) AND 
                CAST(REGEXP_REPLACE(%L, ''[^0-9]'', '''', ''g'') AS INTEGER)',
                article_numbers[1], -- 範囲検索の場合は最初の条文番号を使用
                end_article
            );
        END IF;
    ELSE
        article_number_condition := 'true';
    END IF;

    debug := jsonb_build_object(
        'search_level', search_level,
        'match_threshold', match_threshold,
        'article_numbers', article_numbers,
        'article_number_condition', article_number_condition
    );

    RETURN QUERY
    WITH article_matches AS (
        SELECT
            a.id,
            a.title,
            a.content_full as content,
            a.article_number,
            a.regulation_id,
            a.chapter_id,
            1 - (e.embedding <=> query_embedding) as similarity,
            EXISTS (
                SELECT 1 FROM content_tags ct
                JOIN tags t ON ct.tag_id = t.id
                WHERE ct.content_id = a.id
                AND ct.content_type = 'article'
                AND t.name = 'definitions'
            ) as is_definitions
        FROM articles a
        JOIN embeddings e ON e.source_id = a.id 
            AND e.source_type = 'article'
            AND e.content_type = 'full_text'
        WHERE
            CASE
                WHEN array_length(regulation_filters, 1) > 0 THEN
                    a.regulation_id::text = ANY(regulation_filters)
                ELSE true
            END
            AND 1 - (e.embedding <=> query_embedding) > match_threshold
            AND article_number_condition::text::boolean
        ORDER BY similarity DESC
        LIMIT match_count
    ),
    article_debug AS (
        -- 各条文のデバッグ情報を収集
        SELECT
            a.id as article_id,
            a.article_number,
            a.is_definitions,
            (jsonb_build_object(
                'article_number', a.article_number,
                'is_definitions', a.is_definitions,
                'similarity', CAST(ROUND(CAST(a.similarity * 100 as numeric), 2) as double precision)
            ))::jsonb as article_debug_info
        FROM article_matches a
    ),
    paragraph_matches AS (
        SELECT
            p.id as paragraph_id,
            p.article_id,
            p.paragraph_number,
            1 - (e.embedding <=> query_embedding) as similarity,
            CASE 
                WHEN 1 - (e.embedding <=> query_embedding) > match_threshold THEN true 
                ELSE false 
            END as is_above_threshold
        FROM paragraphs p
        JOIN article_matches am ON p.article_id = am.id
        JOIN embeddings e ON e.source_id = p.id
            AND e.source_type = 'paragraph'
            AND e.content_type = 'full_text'
        WHERE search_level = 'paragraph'
        AND NOT am.is_definitions
    ),
    subparagraph_matches AS (
        SELECT
            pe.id as element_id,
            pe.paragraph_id,
            pe.content,
            pe.element_id as letter,
            pe.order_index,
            1 - (e.embedding <=> query_embedding) as similarity
        FROM article_matches am
        JOIN paragraphs p ON p.article_id = am.id
        JOIN paragraph_elements pe ON pe.paragraph_id = p.id
        LEFT JOIN embeddings e ON e.source_id = pe.id
            AND e.source_type = 'subparagraph'
            AND e.content_type = 'full_text'
        WHERE am.is_definitions 
        AND pe.type = 'subparagraph'
        ORDER BY pe.order_index
    ),
    subparagraph_debug AS (
        -- サブパラグラフのデバッグ情報を収集
        SELECT
            sm.element_id,
            (jsonb_build_object(
                'element_id', sm.element_id,
                'content', LEFT(sm.content, 50),  -- デバッグ用にコンテンツの一部を含める
                'similarity', CAST(ROUND(CAST(sm.similarity * 100 as numeric), 2) as double precision)
            ))::jsonb as subparagraph_debug_info
        FROM subparagraph_matches sm
        WHERE sm.similarity > match_threshold  -- 閾値を超えるものだけ
    )
    SELECT
        am.id,
        am.title,
        am.content,
        am.article_number,
        am.regulation_id,
        COALESCE(
            (
                SELECT jsonb_agg(jsonb_build_object(
                    'id', r.id,
                    'name', r.name
                ))
                FROM regulations r
                WHERE r.id = am.regulation_id
            ),
            '[]'::jsonb
        ) as regulation,
        COALESCE(
            (
                SELECT jsonb_agg(jsonb_build_object(
                    'id', c.id,
                    'chapter_number', c.chapter_number,
                    'title', c.title
                ))
                FROM chapters c
                WHERE c.id = am.chapter_id
            ),
            '[]'::jsonb
        ) as chapter,
        CAST(ROUND(CAST(am.similarity * 100 as numeric), 2) as double precision) as similarity_percentage,
        CASE
            WHEN search_level = 'paragraph' AND am.is_definitions THEN
                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', p.id,
                                'paragraph_number', p.paragraph_number,
                                'elements', (
                                    SELECT jsonb_agg(
                                        jsonb_build_object(
                                            'id', pe.id,
                                            'type', pe.type,
                                            'content', pe.content,
                                            'element_id', pe.element_id,
                                            'order_index', pe.order_index,
                                            'similarity_percentage', COALESCE(
                                                CAST(ROUND(CAST(sm.similarity * 100 as numeric), 2) as double precision),
                                                0
                                            )
                                        )
                                        ORDER BY pe.order_index
                                    )
                                    FROM paragraph_elements pe
                                    LEFT JOIN subparagraph_matches sm ON pe.id = sm.element_id
                                    WHERE pe.paragraph_id = p.id
                                    AND pe.type = 'subparagraph'
                                )
                            )
                            ORDER BY p.paragraph_number
                        )
                        FROM paragraphs p
                        WHERE p.article_id = am.id
                    ),
                    '[]'::jsonb
                )
            WHEN search_level = 'paragraph' THEN
                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', p.id,
                                'paragraph_number', p.paragraph_number,
                                'elements', (
                                    SELECT jsonb_agg(
                                        jsonb_build_object(
                                            'id', pe.id,
                                            'type', pe.type,
                                            'content', pe.content,
                                            'element_id', pe.element_id,
                                            'order_index', pe.order_index
                                        )
                                        ORDER BY pe.order_index
                                    )
                                    FROM paragraph_elements pe
                                    WHERE pe.paragraph_id = p.id
                                ),
                                'similarity_percentage', COALESCE(
                                    CAST(ROUND(CAST(pm.similarity * 100 as numeric), 2) as double precision),
                                    0
                                )
                            )
                            ORDER BY p.paragraph_number
                        )
                        FROM paragraphs p
                        LEFT JOIN paragraph_matches pm ON p.id = pm.paragraph_id
                        WHERE p.article_id = am.id
                    ),
                    '[]'::jsonb
                )
            ELSE
                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', p.id,
                                'paragraph_number', p.paragraph_number,
                                'elements', (
                                    SELECT jsonb_agg(
                                        jsonb_build_object(
                                            'id', pe.id,
                                            'type', pe.type,
                                            'content', pe.content,
                                            'element_id', pe.element_id,
                                            'order_index', pe.order_index
                                        )
                                        ORDER BY pe.order_index
                                    )
                                    FROM paragraph_elements pe
                                    WHERE pe.paragraph_id = p.id
                                )
                            )
                            ORDER BY p.paragraph_number
                        )
                        FROM paragraphs p
                        WHERE p.article_id = am.id
                    ),
                    '[]'::jsonb
                )
        END as paragraphs,
        jsonb_build_object(
            'article', (SELECT article_debug_info FROM article_debug WHERE article_id = am.id),
            'subparagraphs', (
                SELECT jsonb_agg(subparagraph_debug_info)
                FROM subparagraph_debug 
                WHERE element_id IN (
                    SELECT pe.id 
                    FROM paragraph_elements pe 
                    WHERE pe.paragraph_id IN (
                        SELECT p.id 
                        FROM paragraphs p 
                        WHERE p.article_id = am.id
                    )
                )
            ),
            'search_type', 'semantic',
            'threshold', match_threshold,
            'search_level', search_level,
            'article_numbers', article_numbers,
            'article_number_condition', article_number_condition
        ) as debug_info
    FROM article_matches am
    ORDER BY am.similarity DESC;
END;
$$;