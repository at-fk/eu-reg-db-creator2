-- タグ付けの結果を確認するクエリ
SELECT 
    r.name as regulation_name,
    a.article_number,
    a.title as article_title,
    ct.confidence,
    ct.metadata->>'matching_criteria' as matching_criteria
FROM content_tags ct
JOIN articles a ON ct.content_id = a.id
JOIN regulations r ON a.regulation_id = r.id
JOIN tags t ON ct.tag_id = t.id
WHERE t.name = 'definitions'
ORDER BY r.name, a.article_number;
