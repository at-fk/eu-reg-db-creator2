export type SearchErrorType =
  | 'TRANSFORM_ERROR'
  | 'SEARCH_ERROR'
  | 'KEYWORD_SEARCH_ERROR'
  | 'SEMANTIC_SEARCH_ERROR'
  | 'ARTICLE_SEARCH_ERROR'
  | 'ARTICLE_RANGE_SEARCH_ERROR'
  | 'STRUCTURE_SEARCH_ERROR'
  | 'EMBEDDING_ERROR'
  | 'VALIDATION_ERROR'
  | 'REGULATION_FETCH_ERROR'
  | 'NOT_FOUND'
  | 'NO_RESULTS_ERROR';

export class SearchError extends Error {
  constructor(
    message: string,
    public type: SearchErrorType,
    public originalError?: Error | unknown
  ) {
    super(message);
    this.name = 'SearchError';
  }
} 