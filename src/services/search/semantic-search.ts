import { SearchParams } from '@/types/domain/search/params';
import { SearchResponse } from '@/types/api/response/search';
import { SearchService } from '@/types/domain/search/service';
import { SearchResult } from '@/types/domain/search/result';
import { SearchResultTransformer } from './transformer';
import { supabaseServer } from '@/lib/supabase/server';
import { SearchError } from '@/lib/error-handling';
import { debug } from '@/lib/error-handling';

export class SemanticSearchService implements SearchService {
  async search(params: SearchParams): Promise<SearchResponse> {
    try {
      debug('SemanticSearchService', 'Search params:', params);
      this.validateParams(params);

      const results = await this.executeSearch(params);
      const transformedResults = this.transformResults(results, params);
      
      debug('SemanticSearchService', 'Transformed results:', transformedResults);
      return {
        data: {
          results: transformedResults,
          total: results.length,
          page: params.page || 1,
          pageSize: params.pageSize || 10
        },
        error: null
      };
    } catch (error) {
      if (error instanceof SearchError) {
        throw error;
      }
      throw new SearchError(
        'Error occurred during semantic search',
        'SEMANTIC_SEARCH_ERROR',
        error
      );
    }
  }

  private validateParams(params: SearchParams): void {
    if (!params.regulation_id) {
      throw new SearchError(
        'Regulation ID is required',
        'VALIDATION_ERROR'
      );
    }

    if (!params.semanticQuery?.trim()) {
      throw new SearchError(
        'Search query is required',
        'VALIDATION_ERROR'
      );
    }
  }

  private async executeSearch(params: SearchParams): Promise<any[]> {
    try {
      debug('SemanticSearchService', 'Executing search with params:', {
        query_length: params.semanticQuery?.length,
        threshold: params.similarityThreshold,
        regulation_id: params.regulation_id,
        search_level: params.searchLevel
      });

      const embedding = await this.getEmbedding(params.semanticQuery || '');
      debug('SemanticSearchService', 'Generated embedding successfully');

      const { data, error } = await supabaseServer.rpc('match_articles', {
        query_embedding: embedding,
        match_threshold: params.similarityThreshold || 0.4,
        match_count: params.pageSize || 10,
        regulation_filters: [params.regulation_id],
        search_level: 'paragraph',
        start_article: params.startArticle || null,
        end_article: params.endArticle || null
      });

      if (error) {
        debug('SemanticSearchService', 'Supabase RPC error:', error);
        throw new SearchError(
          'Error occurred during semantic search',
          'SEMANTIC_SEARCH_ERROR',
          error
        );
      }

      if (!data || data.length === 0) {
        debug('SemanticSearchService', 'No results found');
        throw new SearchError(
          'No relevant content found',
          'NO_RESULTS_ERROR'
        );
      }

      debug('SemanticSearchService', 'Search completed successfully', {
        result_count: data.length,
        first_result: data[0] ? {
          id: data[0].id,
          similarity: data[0].similarity
        } : null
      });

      return data;
    } catch (error) {
      debug('SemanticSearchService', 'Search execution error:', error);
      if (error instanceof SearchError) {
        throw error;
      }
      throw new SearchError(
        'Error occurred during semantic search',
        'SEMANTIC_SEARCH_ERROR',
        error
      );
    }
  }

  private transformResults(results: any[], params: SearchParams): SearchResult[] {
    try {
      debug('SemanticSearchService', 'Transforming results', {
        result_count: results.length,
        threshold: params.similarityThreshold
      });

      const transformedResults = SearchResultTransformer.transformResults(results).map(result => {
        // 類似度が閾値以上のパラグラフが1つもない場合は、その結果を除外
        const hasAboveThresholdParagraphs = result.paragraphs.some(p => p.is_above_threshold);
        if (!hasAboveThresholdParagraphs) {
          debug('SemanticSearchService', 'Result excluded due to no above-threshold paragraphs', {
            article_id: result.id,
            article_number: result.metadata.article_number
          });
          return null;
        }

        return {
          ...result,
          debug_info: {
            ...result.debug_info,
            search_type: 'semantic' as const,
            search_level: 'paragraph',
            threshold: params.similarityThreshold || 0.4
          }
        };
      }).filter((result): result is SearchResult => result !== null);

      if (transformedResults.length === 0) {
        debug('SemanticSearchService', 'No results after transformation and filtering');
        throw new SearchError(
          'No content above similarity threshold',
          'NO_RESULTS_ERROR'
        );
      }

      debug('SemanticSearchService', 'Results transformed successfully', {
        transformed_count: transformedResults.length
      });

      return transformedResults;
    } catch (error) {
      debug('SemanticSearchService', 'Result transformation error:', error);
      if (error instanceof SearchError) {
        throw error;
      }
      throw new SearchError(
        'Error transforming search results',
        'TRANSFORM_ERROR',
        error
      );
    }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const response = await fetch(process.env.EMBEDDING_API_URL as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EMBEDDING_API_KEY}`,
      },
      body: JSON.stringify({
        input: text,
        model: "jina-embeddings-v3",
        dimensions: 256,
        task: "retrieval.query",
        late_chunking: false
      }),
    });

    if (!response.ok) {
      throw new SearchError(
        'Failed to generate embedding',
        'EMBEDDING_ERROR'
      );
    }

    const data = await response.json();
    
    if (!data.data?.[0]?.embedding) {
      throw new Error('Invalid response format from Jina API');
    }

    return data.data[0].embedding;
  }
}

export const searchBySemantic = async (params: SearchParams): Promise<SearchResponse> => {
  const service = new SemanticSearchService();
  return service.search(params);
}; 