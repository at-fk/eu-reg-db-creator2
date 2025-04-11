import { SearchParams } from '@/types/domain/search/params';
import { SearchResult } from '@/types/domain/search/result';

export interface SearchService {
  search(params: SearchParams): Promise<SearchResult[]>;
}

export interface ArticleSearchService extends SearchService {
  searchArticles(params: SearchParams): Promise<SearchResult[]>;
}

export interface KeywordSearchService extends SearchService {
  searchByKeyword(params: SearchParams): Promise<SearchResult[]>;
}

export interface SemanticSearchService extends SearchService {
  searchBySemantic(params: SearchParams): Promise<SearchResult[]>;
} 