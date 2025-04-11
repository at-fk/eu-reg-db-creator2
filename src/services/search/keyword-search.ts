// src/services/search/keyword-search.ts

import { SearchParams } from '@/types/domain/search/params';
import { SearchResponse } from '@/types/api/response/search';
import { SearchService } from '@/types/domain/search/service';
import { SearchResult } from '@/types/domain/search/result';
import { SearchResultTransformer } from './transformer';
import { supabaseServer } from '@/lib/supabase/server';
import { SearchError, debug } from '@/lib/error-handling';

export class KeywordSearchService implements SearchService {
  async search(params: SearchParams): Promise<SearchResponse> {
    try {
      debug('KeywordSearchService', 'Search params:', params);
      this.validateParams(params);

      // RPC呼び出し & JSONB展開
      const results = await this.executeSearch(params);
      const transformedResults = this.transformResults(results);

      debug('KeywordSearchService', 'Transformed results:', transformedResults);
      return {
        data: {
          results: transformedResults,
          total: transformedResults.length,
          page: params.page || 1,
          pageSize: params.pageSize || 10
        },
        error: null
      };
    } catch (error) {
      debug('KeywordSearchService', 'Search error:', error);
      if (error instanceof SearchError) {
        throw error;
      }
      throw new SearchError(
        '検索中にエラーが発生しました',
        'SEARCH_ERROR',
        error
      );
    }
  }

  private validateParams(params: SearchParams): void {
    if (!params.regulation_id) {
      throw new SearchError('法令IDは必須です', 'VALIDATION_ERROR');
    }

    // 条文範囲チェック
    if (params.startArticle && params.endArticle) {
      const start = parseInt(params.startArticle);
      const end = parseInt(params.endArticle);
      if (isNaN(start) || isNaN(end) || start < 1 || end < 1) {
        throw new SearchError('条文番号は1以上の数値を指定してください', 'VALIDATION_ERROR');
      }
      if (start > end) {
        throw new SearchError('開始条文番号は終了条文番号以下である必要があります', 'VALIDATION_ERROR');
      }
    }
  }

  private async executeSearch(params: SearchParams): Promise<any[]> {
    const { regulation_id, startArticle, endArticle, keyword } = params;

    // 検索クエリの準備
    // キーワードが空の場合はnullを渡す（条文範囲のみの検索を可能にする）
    const searchQuery = keyword || null;
    const searchMode = 'AND';

    try {
      // 特殊文字のエスケープ処理
      const sanitizedQuery = searchQuery ? searchQuery.replace(/[%_[\]]/g, '\\$&') : null;

      // Supabase RPC 呼び出し
      const { data: rawResults, error } = await supabaseServer.rpc('search_articles', {
        search_query: sanitizedQuery,
        search_mode: searchMode,
        regulation_id,
        start_article: startArticle,
        end_article: endArticle
      });

      if (error) {
        debug('KeywordSearchService', 'Supabase error:', error);
        throw new SearchError('検索中にエラーが発生しました', 'SEARCH_ERROR', error);
      }

      // 返却データを整形
      const results = rawResults || [];
      return results;
    } catch (error) {
      debug('KeywordSearchService', 'Supabase error:', error);
      throw new SearchError('検索中にエラーが発生しました', 'SEARCH_ERROR', error);
    }
  }

  private transformResults(results: any[]): SearchResult[] {
    try {
      return SearchResultTransformer.transformResults(results, 'keyword');
    } catch (error) {
      throw new SearchError(
        '検索結果の変換中にエラーが発生しました',
        'TRANSFORM_ERROR',
        error
      );
    }
  }
}