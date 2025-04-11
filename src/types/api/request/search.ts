import { SearchParams } from '../../domain/search/params';

export interface SearchRequest {
  type: 'article' | 'keyword' | 'semantic';
  params: SearchParams;
}

export interface SearchAPIRequest {
  params: SearchParams;
} 