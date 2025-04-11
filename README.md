# EU Regulation Database and Search Engine

This web application provides a database and search engine for EU regulations (such as EHDS, DMA, etc.).

## Key Features

- Full-text search of EU regulations
- Semantic search
- AI-assisted regulation interpretation
- Structured display of articles
- Reference to related articles

## Tech Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: Supabase (PostgreSQL)
- AI/ML: OpenAI API, Jina AI Embeddings
- Deployment: Vercel

## Local Development Setup

1. Clone the repository:
```bash
git clone https://github.com/your-username/eu-reg-db-creator.git
cd eu-reg-db-creator
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
- Copy `.env.example` to `.env.local`
- Configure the required environment variables

4. Start the development server:
```bash
npm run dev
```

## Environment Variables

The following environment variables are required:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `EMBEDDING_API_URL`: Jina AI Embeddings API URL
- `EMBEDDING_API_KEY`: Jina AI Embeddings API key
- `OPENAI_API_KEY`: OpenAI API key

## License

This project is released under the [MIT License](LICENSE).

---

# EU Regulation Database and Search Engine

このプロジェクトは、EU法令（EHDS、DMA等）のデータベースと検索エンジンを提供するウェブアプリケーションです。

## 主な機能

- EU法令の全文検索
- セマンティック検索
- AI支援による法令解釈
- 条文の構造化表示
- 関連条文の参照

## 技術スタック

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: Supabase (PostgreSQL)
- AI/ML: OpenAI API, Jina AI Embeddings
- Deployment: Vercel

## ローカル開発環境のセットアップ

1. リポジトリのクローン:
```bash
git clone https://github.com/your-username/eu-reg-db-creator.git
cd eu-reg-db-creator
```

2. 依存関係のインストール:
```bash
npm install
```

3. 環境変数の設定:
- `.env.example`ファイルを`.env.local`にコピー
- 必要な環境変数を設定

4. 開発サーバーの起動:
```bash
npm run dev
```

## 環境変数

以下の環境変数が必要です：

- `NEXT_PUBLIC_SUPABASE_URL`: SupabaseプロジェクトのURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabaseの匿名キー
- `SUPABASE_SERVICE_ROLE_KEY`: Supabaseのサービスロールキー
- `EMBEDDING_API_URL`: Jina AI EmbeddingsのAPI URL
- `EMBEDDING_API_KEY`: Jina AI EmbeddingsのAPIキー
- `OPENAI_API_KEY`: OpenAI APIキー

## ライセンス

このプロジェクトは[MITライセンス](LICENSE)の下で公開されています。 