/**
 * 検索結果のメタデータを表すインターフェース
 */
export interface SearchResultMetadata {
  article_number: string;
  regulation_id: string;
  regulation_name?: string;
  regulation_official_title?: string;
  regulation_short_title?: string;
  chapter_number?: string;
  chapter_title?: string;
  similarity_percentage?: number;
  search_type?: 'semantic' | 'keyword';
}

/**
 * 検索結果のマッチを表すインターフェース
 */
export interface SearchResultMatch {
  start: number;
  end: number;
  term: string;
}

/**
 * 検索結果のサブパラグラフを表すインターフェース
 */
export interface SearchResultSubparagraph {
  letter: string;
  content: string;
  matches: SearchResultMatch[];
  similarity_percentage?: number;  // パーセンテージ形式の類似度（0-100）
}

/**
 * 検索結果のパラグラフを表すインターフェース
 */
export interface SearchResultParagraph {
  number: string;
  content?: string;
  matches: SearchResultMatch[];
  subparagraphs?: SearchResultSubparagraph[];
  elements?: ParagraphElement[];
  similarity_percentage?: number;  // パーセンテージ形式の類似度（0-100）
  is_above_threshold?: boolean;
}

export interface ParagraphElement {
  type: 'chapeau' | 'subparagraph';
  content: string;
  letter?: string;
  matches: SearchResultMatch[];
  order_index: number;
  similarity_percentage?: number;  // パーセンテージ形式の類似度（0-100）
}

/**
 * 検索結果を表すインターフェース
 */
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  article_number?: string;
  metadata: SearchResultMetadata;
  paragraphs: SearchResultParagraph[];
  debug_info?: {
    article?: {
      article_number: string;
      is_definitions: boolean;
      similarity: number;
    };
    subparagraphs?: Array<{
      element_id: string;
      similarity: number;
    }>;
    search_type?: 'semantic' | 'keyword';
    threshold?: number;
    search_level?: 'article' | 'paragraph';
  };
}

/**
 * 検索レスポンスを表すインターフェース
 */
export interface SearchResponse {
  data: {
    results: SearchResult[];
  };
  error: null | {
    message: string;
  };
}

/**
 * グループ化された検索結果を表すインターフェース
 */
export interface GroupedSearchResult {
  article_number: string;
  title: string;
  content_full: string;
  similarity: number;
  matched_paragraphs: {
    number: string;
    content: string;
    score: number;
  }[];
}

/**
 * 検索結果用のパラグラフを表すインターフェース
 */
export interface SearchParagraph {
  id: string;
  paragraph_number: string;
  content: string;
  content_full: string;
  similarity?: number;
  subparagraphs?: SearchSubparagraph[];
}

/**
 * 検索結果用のサブパラグラフを表すインターフェース
 */
export interface SearchSubparagraph {
  subparagraph_id: string;
  content: string;
  similarity?: number;
}

/**
 * セマンティック検索データを表すインターフェース
 */
export interface SemanticSearchData {
  id: string;
  title: string;
  content_full: string;
  article_number: string;
  regulation_id: string;
  regulation?: { name: string }[];
  chapter?: { chapter_number: string; title: string }[];
  similarity: number;
  paragraphs?: SearchParagraph[];
}

export interface UnifiedSearchResponse {
  results: Array<{
    id: string;
    title: string;
    content: string;
    article_number: string;
    regulation_id: string;
    regulation?: { name: string }[];
    chapter?: { chapter_number: string; title: string }[];
    paragraphs: Array<{
      number: string;
      content: string;
      matches: Array<{ start: number; end: number }>;
      subparagraphs?: Array<{
        letter: string;
        content: string;
        matches: Array<{ start: number; end: number }>;
      }>;
    }>;
  }>;
}

export type UnifiedSearchResult = {
  id: string;
  title: string;
  content: string;
  article_number: string;
  regulation_id: string;
  regulation?: { name: string }[];
  chapter?: { chapter_number: string; title: string }[];
  paragraphs: Array<{
    number: string;
    content: string;
    matches: Array<{ start: number; end: number }>;
    subparagraphs?: Array<{
      letter: string;
      content: string;
      matches: Array<{ start: number; end: number }>;
    }>;
  }>;
}; 