/**
 * 検索タイプの定義
 */
export type SearchType = 'keyword' | 'semantic' | 'article' | 'combined';

/**
 * 検索モードの定義
 */
export type SearchMode = 'AND' | 'OR';

/**
 * 検索スコープの定義
 */
export type SearchScope = 'ARTICLE' | 'TITLE' | 'FULL';

/**
 * セマンティック検索スコープの定義
 */
export type SemanticSearchScope = 'ARTICLE' | 'TITLE' | 'FULL';

/**
 * 検索レベルの定義
 */
export type SearchLevel = 'article' | 'paragraph';

/**
 * 検索パラメータを表すインターフェース
 */
export interface SearchParams {
  type: SearchType;
  keyword?: string;
  semanticQuery?: string;
  regulation_id?: string;
  startArticle?: string;
  endArticle?: string;
  searchMode?: SearchMode;
  page?: number;
  pageSize?: number;
  similarityThreshold?: number;
  searchLevel?: SearchLevel;
  useAllMatches?: boolean;
  keywordQuery?: string;
  maxContexts?: number;
} 