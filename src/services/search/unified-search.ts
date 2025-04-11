import { SearchParams } from '@/types/domain/search/params';
import { SearchResponse } from '@/types/api/response/search';
import { SearchService } from '@/types/domain/search/service';
import { SearchError } from '@/lib/error-handling';
import { debug } from '@/lib/error-handling';
import { KeywordSearchService } from './keyword-search';
import { SemanticSearchService } from './semantic-search';

export class UnifiedSearchService implements SearchService {
  private keywordSearchService: KeywordSearchService;

  constructor() {
    this.keywordSearchService = new KeywordSearchService();
  }

  async search(params: SearchParams): Promise<SearchResponse> {
    debug('UnifiedSearchService', 'Search params:', params);
    const searchService = this.determineSearchStrategy(params);
    return searchService.search(params);
  }

  private determineSearchStrategy(params: SearchParams): SearchService {
    debug('UnifiedSearchService', 'Determining search strategy for params:', params);

    // 意味検索の場合
    if (params.semanticQuery && params.type === 'semantic') {
      debug('UnifiedSearchService', 'Using SemanticSearchService');
      return new SemanticSearchService();
    }

    // その他すべての検索（キーワード検索、条文範囲検索、または両方の組み合わせ）
    debug('UnifiedSearchService', 'Using KeywordSearchService');
    return this.keywordSearchService;
  }
}