import { PostgrestError } from '@supabase/supabase-js';
import { SearchErrorType, SearchError } from '@/types/common/error';

// エラータイプの定義
export type ErrorType = 
  | 'DATABASE_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'UNKNOWN_ERROR'
  | 'SEARCH_ERROR'
  | 'INVALID_SEARCH_TYPE'
  | 'INVALID_PARAMS';

// カスタムエラークラス
export class AppError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// 再エクスポート
export { SearchError };
export type { SearchErrorType };

// デバッグ用の設定
const DEBUG = process.env.NODE_ENV === 'development';

// デバッグログ出力
export function debug(service: string, ...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${service}]`, ...args);
  }
}

// Supabaseのエラーハンドリング
export function handleSupabaseError(error: unknown, component: string): AppError {
  debug(component, 'Supabase error:', error);

  if ((error as any)?.code === 'PGRST') {
    return new AppError(
      (error as any).message || 'Database error occurred',
      'DATABASE_ERROR',
      error
    );
  }

  if (error instanceof Error) {
    if (error.message.includes('network')) {
      return new AppError(
        'ネットワークエラーが発生しました',
        'NETWORK_ERROR',
        error
      );
    }
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      error
    );
  }

  return new AppError(
    'Unknown error occurred',
    'UNKNOWN_ERROR',
    error
  );
}

// API用のエラーハンドリング
export function handleAPIError(error: unknown, component: string): Response {
  const appError = error instanceof AppError ? error : handleSupabaseError(error, component);
  debug(component, 'API error:', appError);

  const statusCode = getStatusCodeForErrorType(appError.type);
  return new Response(
    JSON.stringify({ 
      error: {
        message: appError.message,
        type: appError.type
      }
    }),
    { 
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// エラータイプに応じたステータスコードの取得
function getStatusCodeForErrorType(type: ErrorType): number {
  switch (type) {
    case 'NOT_FOUND':
      return 404;
    case 'UNAUTHORIZED':
      return 401;
    case 'VALIDATION_ERROR':
      return 400;
    case 'DATABASE_ERROR':
    case 'SEARCH_ERROR':
    case 'INVALID_SEARCH_TYPE':
      return 500;
    default:
      return 500;
  }
}

// 検索関連のエラーハンドリング
export function handleSearchError(error: unknown, code: SearchErrorType, message: string): never {
  if (error instanceof SearchError) {
    throw error;
  }
  throw new SearchError(
    message,
    code,
    error instanceof Error ? error : new Error(String(error))
  );
}

// ユーザーフレンドリーなエラーメッセージの生成
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    switch (error.type) {
      case 'DATABASE_ERROR':
        return 'データベースへのアクセスに失敗しました';
      case 'NETWORK_ERROR':
        return 'ネットワーク接続に問題が発生しました';
      case 'VALIDATION_ERROR':
        return '入力内容に問題があります';
      case 'NOT_FOUND':
        return '要求されたリソースが見つかりません';
      case 'UNAUTHORIZED':
        return 'アクセス権限がありません';
      case 'SEARCH_ERROR':
        return '検索中にエラーが発生しました';
      case 'INVALID_SEARCH_TYPE':
        return '無効な検索タイプが指定されました';
      default:
        return 'エラーが発生しました';
    }
  }

  if (error instanceof Error) {
    return DEBUG ? error.message : 'エラーが発生しました';
  }

  return 'エラーが発生しました';
}

// ローディング状態の管理用ヘルパー
export interface LoadingState {
  loading: boolean;
  error: Error | null;
}

export function createLoadingState(): LoadingState {
  return {
    loading: false,
    error: null
  };
} 