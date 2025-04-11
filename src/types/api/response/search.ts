import { BaseAPIResponse } from '../../common/base';
import { SearchResult } from '../../domain/search/result';

export interface SearchResponseData {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
}

export type SearchResponse = BaseAPIResponse<SearchResponseData>; 