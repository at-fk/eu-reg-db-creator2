import { SearchResult } from '@/types/domain/search/result';
import { debug } from '@/lib/error-handling';

export interface Context {
  content: string;
  metadata: {
    regulation_id: string;
    regulation_name: string;
    article_number: string;
    title: string;
    paragraph_number?: string;
  };
}

export function buildContext(results: SearchResult[]): Context[] {
  return results.map(result => ({
    content: result.content,
    metadata: {
      regulation_id: result.metadata.regulation_id || '',
      regulation_name: result.metadata.regulation_name || '',
      article_number: result.metadata.article_number || '',
      title: result.title || '',
    },
  }));
}

export function buildContextFromParagraphs(results: SearchResult[], maxContexts: number = 5): Context[] {
  debug('Context Builder', 'Starting context building with results:', 
    results.map(r => ({
      article: r.metadata.article_number,
      search_level: r.debug_info?.search_level,
      search_type: r.debug_info?.search_type,
      threshold: r.debug_info?.threshold
    }))
  );

  // パラグラフの類似度でソートするための配列を作成
  const allParagraphs = results.flatMap(result => {
    const paragraphs = result.paragraphs || [];
    return paragraphs
      .filter(p => {
        // パラグラフレベルの検索の場合
        if (result.debug_info?.search_type === 'semantic' && result.debug_info?.search_level === 'paragraph') {
          const threshold = (result.debug_info?.threshold || 0.6) * 100;
          const isAboveThreshold = (p.similarity_percentage || 0) > threshold;
          debug('Context Builder', `Article ${result.metadata.article_number}, Paragraph ${p.number}:`, {
            similarity: p.similarity_percentage,
            threshold: threshold,
            isAboveThreshold: isAboveThreshold,
            content: p.elements?.map(e => e.content).join('\n').substring(0, 100) + '...'
          });
          return isAboveThreshold;
        }

        // キーワード検索の場合
        if (result.debug_info?.search_type === 'keyword') {
          const hasMatches = p.matches && p.matches.length > 0;
          debug('Context Builder', `Article ${result.metadata.article_number}, Paragraph ${p.number} (keyword search):`, {
            hasMatches: hasMatches,
            matchCount: p.matches?.length || 0
          });
          return hasMatches;
        }

        // 条文レベルの検索の場合は全てのパラグラフを含める
        const isArticleLevel = result.debug_info?.search_level === 'article';
        debug('Context Builder', `Article ${result.metadata.article_number}, Paragraph ${p.number} (article-level search):`, {
          isArticleLevel: isArticleLevel
        });
        return isArticleLevel;
      })
      .map(p => ({
        content: p.elements?.map(e => e.content).join('\n') || '',
        metadata: {
          regulation_id: result.metadata.regulation_id || '',
          regulation_name: result.metadata.regulation_name || '',
          article_number: result.metadata.article_number || '',
          title: result.title || '',
          paragraph_number: p.number || '',
        },
        similarity_percentage: p.similarity_percentage || 0
      }));
  });

  // 類似度でソートし、上位N個を選択
  const sortedParagraphs = allParagraphs
    .sort((a, b) => b.similarity_percentage - a.similarity_percentage)
    .slice(0, Math.min(maxContexts, 10));

  debug('Context Builder', 'Final context summary:', {
    totalContexts: sortedParagraphs.length,
    articles: sortedParagraphs.map(c => ({
      article: c.metadata.article_number,
      paragraph: c.metadata.paragraph_number,
      similarity: c.similarity_percentage,
      contentPreview: c.content.substring(0, 100) + '...'
    }))
  });

  return sortedParagraphs.map(({ content, metadata }) => ({ content, metadata }));
}

export function buildContextString(contexts: Context[]): string {
  return contexts
    .map(
      context => `
Article ${context.metadata.article_number} of ${context.metadata.regulation_name}${context.metadata.paragraph_number ? ` (Paragraph ${context.metadata.paragraph_number})` : ''}:
${context.content}
`
    )
    .join('\n');
} 