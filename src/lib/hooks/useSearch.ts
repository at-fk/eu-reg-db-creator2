import { useState, useCallback } from 'react';
import { SearchResult, SearchResponse } from '@/types/domain/search/result';
import { SearchParams } from '@/types/domain/search/params';
import { SearchError, debug } from '@/lib/error-handling';

interface UseSearchReturn {
  results: SearchResult[];
  loading: boolean;
  error: SearchError | null;
  search: (params: SearchParams) => Promise<void>;
}

export function useSearch(): UseSearchReturn {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);

  const search = useCallback(async (params: SearchParams) => {
    setLoading(true);
    setError(null);

    debug('useSearch', 'Search params:', params);

    try {
      const { regulation_id, startArticle, endArticle, keyword } = params;

      // 空文字列の場合はnullに変換
      const normalizedStartArticle = startArticle?.trim() || null;
      const normalizedEndArticle = endArticle?.trim() || null;

      // APIエンドポイントを呼び出し
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          startArticle: normalizedStartArticle,
          endArticle: normalizedEndArticle,
        }),
      });

      if (!response.ok) {
        throw new SearchError(
          'Failed to make API request',
          'SEARCH_ERROR'
        );
      }

      const data = await response.json();

      if (!data || !data.data || !Array.isArray(data.data.results)) {
        throw new SearchError(
          'Invalid response format',
          'SEARCH_ERROR'
        );
      }

      setResults(data.data.results);
    } catch (err) {
      debug('useSearch', 'Search error:', err);
      setError(
        err instanceof SearchError 
          ? err 
          : new SearchError('Error occurred during search', 'SEARCH_ERROR', err)
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
} 