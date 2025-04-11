import { SearchParams } from './params';
import { SearchResponse } from '@/types/api/response/search';

/**
 * 検索サービスの共通インターフェース
 */
export interface SearchService {
  search(params: SearchParams): Promise<SearchResponse>;
} 