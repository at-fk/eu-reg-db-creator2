// ===================== ここから (transformer.ts) 全コピペ =====================
import { SearchResult, SearchResultParagraph } from '@/types/domain/search/result';
import { debug } from '@/lib/error-handling';

export interface ParagraphElement {
  type: 'chapeau' | 'subparagraph';
  content: string;
  element_id?: string;
  letter?: string;
  order_index: number;
  matches?: Array<{ start: number; end: number; term: string }>;
  similarity_percentage?: number;
  similarity?: number;
}

export class SearchResultTransformer {
  static transformResults(
    results: any[],
    searchType: 'keyword' | 'semantic' | 'article' = 'semantic'
  ): SearchResult[] {
    try {
      debug('Transforming search results:', {
        count: results.length,
        searchType,
        firstResult: results[0]
          ? { id: results[0].id, title: results[0].title, debug_info: results[0].debug_info }
          : null,
      });

      const transformedResults = results.map((result) => {
        debug('Processing result:', {
          id: result.id,
          title: result.title,
          paragraphCount: result.paragraphs?.length || 0,
          debug_info: result.debug_info,
        });

        const transformedParagraphs =
          searchType === 'keyword'
            ? this.transformParagraphsWithMatches(result.paragraphs || [])
            : this.transformParagraphs(result.paragraphs || [], result.debug_info?.threshold);

        // パラグラフ番号順に並べ替え
        const sortedParagraphs = this.sortParagraphsByNumber(transformedParagraphs);

        return {
          id: result.id,
          title: result.title,
          content: result.content || '',
          metadata: {
            article_number: result.metadata?.article_number || result.article_number || '',
            regulation_id: result.metadata?.regulation_id || result.regulation?.[0]?.id,
            regulation_name: result.regulation?.[0]?.name || '',
            chapter_number: result.chapter?.[0]?.chapter_number || '',
            chapter_title: result.chapter?.[0]?.title || '',
            similarity_percentage:
              result.similarity_percentage ||
              (result.similarity ? parseFloat((result.similarity * 100).toFixed(2)) : undefined),
            search_type: result.debug_info?.search_type || searchType,
          },
          paragraphs: sortedParagraphs,
          debug_info: result.debug_info,
        };
      });

      debug(
        'Transformed results summary:',
        transformedResults.map((r) => ({
          id: r.id,
          title: r.title,
          paragraphCount: r.paragraphs.length,
          hasMatches: r.paragraphs.some((p) =>
            p.elements?.some((e) => e.matches && e.matches.length > 0)
          ),
        }))
      );

      return transformedResults;
    } catch (error) {
      throw new Error(
        `Error occurred during transformation of search results: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * キーワード検索用に、パラグラフ内の matches 情報を保持。
   */
  private static transformParagraphsWithMatches(paragraphs: any[]): SearchResultParagraph[] {
    debug('Transforming paragraphs with matches:', {
      count: paragraphs.length,
      firstParagraph: paragraphs[0] ? {
        number: paragraphs[0].number || paragraphs[0].paragraph_number,
        elementCount: paragraphs[0].elements?.length || 0
      } : null
    });
    
    const transformedParagraphs = paragraphs.map(p => {
      debug('Processing paragraph:', { 
        number: p.number || p.paragraph_number,
        elementCount: p.elements?.length || 0
      });
      
      return {
        number: p.number || p.paragraph_number || '',
        content: p.content || '',
        matches: [],
        elements: (p.elements || []).map((e: ParagraphElement) => {
          const elementMatches = e.matches || [];
          debug('Processing element:', {
            type: e.type,
            matchCount: elementMatches.length,
            matches: elementMatches,
            content: e.content?.substring(0, 50) + '...'
          });
          
          return {
            type: e.type || 'subparagraph',
            content: e.content || '',
            letter: e.letter || e.element_id,
            matches: elementMatches,
            order_index: e.order_index || 0
          };
        })
      };
    });

    debug('Transformed paragraphs summary:', {
      totalParagraphs: transformedParagraphs.length,
      elementsWithMatches: transformedParagraphs.reduce((count, p) => 
        count + (p.elements?.filter((e: ParagraphElement) => e.matches && e.matches.length > 0).length || 0), 0)
    });
    
    return transformedParagraphs;
  }

  /**
   * セマンティック検索/条文検索用の通常パラグラフ変換 (matches は扱わない)。
   */
  private static transformParagraphs(paragraphs: any[], threshold?: number): SearchResultParagraph[] {
    return paragraphs.map(p => ({
      number: p.number || p.paragraph_number || '',
      content: p.content || '',
      similarity_percentage: p.similarity_percentage,
      is_above_threshold: p.is_above_threshold ?? 
        (p.similarity_percentage !== undefined && threshold !== undefined && 
         p.similarity_percentage >= threshold * 100),
      elements: (p.elements || []).map((e: ParagraphElement) => ({
        type: e.type || 'subparagraph',
        content: e.content || '',
        letter: e.letter || e.element_id,
        similarity_percentage: e.similarity_percentage,
        matches: e.matches || [],
        order_index: e.order_index || 0
      })),
      matches: p.matches || []
    }));
  }

  /**
   * パラグラフ番号を昇順にソート (数値として比較)。
   */
  private static sortParagraphsByNumber(paragraphs: SearchResultParagraph[]): SearchResultParagraph[] {
    const numericRegex = /^\d+$/;
    return paragraphs.slice().sort((a, b) => {
      const aTrim = a.number.trim();
      const bTrim = b.number.trim();
      const aIsNum = numericRegex.test(aTrim);
      const bIsNum = numericRegex.test(bTrim);

      if (aIsNum && bIsNum) {
        return parseInt(aTrim, 10) - parseInt(bTrim, 10);
      } else {
        return aTrim.localeCompare(bTrim, undefined, { numeric: true });
      }
    });
  }
}
// ===================== ここまで (transformer.ts) =====================