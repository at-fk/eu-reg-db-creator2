# Supabase PostgreSQL バックアップ & 復元メモ（外部キー制約対応付き）

## ✅ 目的

Supabaseのデータベースをバックアップ・復元したいが、外部キー制約（Foreign Key Constraints）の循環参照により、復元時にエラーが出る可能性がある。その対処法とコマンドを整理。

---

## 🧪 バックアップの取得

1. Supabaseの上部メニューから「**Connect**」をクリック
2. 表示される **PostgreSQL接続文字列（例）** を確認：
postgres://postgres:YF4rx2nFwBYJnrp3@.supabase.co:5432/postgres

```bash
# バックアップ取得コマンド
pg_dump postgresql://postgres:YF4rx2nFwBYJnrp3@db.gujeqgawwsnzkglyqeqq.supabase.co:5432/postgres > backup.dump
```

## 🔄 バックアップの復元

1. バックアップファイルをローカルに保存
2. 復元コマンドを実行

# 1. 制約を一時的に無効化（必要に応じて）
psql "postgres://postgres:your_new_password@db.newproject.supabase.co:5432/postgres" -c "SET session_replication_role = replica;"

# 2. 復元
psql "postgres://postgres:your_new_password@db.newproject.supabase.co:5432/postgres" -f backup.sql

# 3. 制約を戻す
psql "postgres://postgres:your_new_password@db.newproject.supabase.co:5432/postgres" -c "SET session_replication_role = DEFAULT;"
