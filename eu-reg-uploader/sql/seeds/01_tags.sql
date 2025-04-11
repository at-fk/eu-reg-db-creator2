-- タグの基本データを作成
INSERT INTO tags (name, description)
VALUES ('definitions', '定義規定を示すタグ')
ON CONFLICT (name) DO NOTHING;
