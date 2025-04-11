-- 検索クエリのパース関数のドロップ
DROP FUNCTION IF EXISTS parse_search_query(text);

-- 検索クエリのパース関数
-- 入力: 検索クエリ文字列
-- 出力: パースされた検索語の配列
-- 例:
--   'test query' -> ['test', 'query']
--   '"data protection" authority' -> ['data protection', 'authority']
--   '"personal data" "data subject"' -> ['personal data', 'data subject']
CREATE OR REPLACE FUNCTION parse_search_query(query text)
RETURNS text[] AS $$
DECLARE
    result text[];
    current_term text := '';
    in_quotes boolean := false;
    i int;
BEGIN
    -- クエリが空の場合は空配列を返す
    IF query IS NULL OR trim(query) = '' THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    -- 文字ごとに処理
    FOR i IN 1..length(query) LOOP
        CASE
            WHEN substring(query from i for 1) = '"' THEN
                IF in_quotes THEN
                    -- クォートの終わり
                    IF current_term != '' THEN
                        result := array_append(result, trim(current_term));
                    END IF;
                    current_term := '';
                END IF;
                in_quotes := NOT in_quotes;
            WHEN substring(query from i for 1) = ' ' AND NOT in_quotes THEN
                -- クォート外のスペース
                IF current_term != '' THEN
                    result := array_append(result, trim(current_term));
                    current_term := '';
                END IF;
            ELSE
                -- 通常の文字
                current_term := current_term || substring(query from i for 1);
        END CASE;
    END LOOP;
    
    -- 最後の単語を追加
    IF current_term != '' THEN
        result := array_append(result, trim(current_term));
    END IF;
    
    -- 空の要素を除去
    RETURN array_remove(result, '');
END;
$$ LANGUAGE plpgsql; 