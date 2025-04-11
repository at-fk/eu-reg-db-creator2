import { NextRequest, NextResponse } from 'next/server';
import { debug } from '@/lib/error-handling';
import { createOpenAIChatCompletion } from '@/lib/ai/createOpenAIChatCompletion';
import { ResponseLanguage } from '@/lib/ai/createOpenAIChatCompletion';
import { searchBySemantic } from '@/services/search/semantic-search';
import { SearchParams } from '@/types/domain/search/params';

/**
 * セマンティック検索の結果からコンテキストを構築する関数
 */
async function buildContextFromSemanticSearch(params: SearchParams) {
  const searchResults = await searchBySemantic(params);
  
  if (!searchResults.data?.results || searchResults.data.results.length === 0) {
    throw new Error('No relevant content found');
  }

  // すべてのパラグラフを平坦化して類似度でソート
  const allParagraphs = searchResults.data.results.flatMap(result => 
    (result.paragraphs || [])
      .filter(p => p.is_above_threshold)
      .map(p => ({
        article_number: result.metadata.article_number,
        regulation_name: result.metadata.regulation_name || '',
        title: result.title,
        paragraph: p
      }))
  ).sort((a, b) => (b.paragraph.similarity_percentage || 0) - (a.paragraph.similarity_percentage || 0));

  if (allParagraphs.length === 0) {
    throw new Error('No content above similarity threshold');
  }

  // maxContextsで制限（デフォルト10、最大30）
  const maxContexts = Math.min(params.maxContexts || 10, 30);
  const selectedParagraphs = allParagraphs.slice(0, maxContexts);

  // コンテキスト文字列を構築
  const contextString = selectedParagraphs
    .map((item, idx) => [
      `【選択結果${idx + 1}】`,
      item.regulation_name,
      `Article ${item.article_number}${item.title ? `: ${item.title}` : ''}`,
      `Paragraph ${item.paragraph.number}:\n${item.paragraph.elements?.map(e => e.content).join('\n') || ''}`
    ].filter(Boolean).join('\n'))
    .join('\n\n');

  return contextString;
}

/**
 * メインのPOSTハンドラ
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const { query, searchParams, language = 'ja' } = await request.json();

  try {
    // セマンティック検索を実行してコンテキストを構築
    const contextString = await buildContextFromSemanticSearch({
      type: 'semantic',
      regulation_id: searchParams.regulation_id,
      semanticQuery: query,
      searchLevel: 'paragraph',
      similarityThreshold: searchParams.similarityThreshold,
      maxContexts: searchParams.maxContexts,
    });

    // Server-Sent Eventsのレスポンスを設定
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // コンテキスト情報を送信
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'context',
              usedContext: contextString
            })}\n\n`)
          );

          // createOpenAIChatCompletionを使用してAI応答を生成
          const completion = createOpenAIChatCompletion(
            query,
            contextString,
            language as ResponseLanguage
          );

          // ストリーミングレスポンスを処理
          for await (const chunk of completion) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
            );
          }

          // 完了を示すメッセージを送信
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              error: error instanceof Error ? error.message : 'An error occurred'
            })}\n\n`)
          );
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      `data: ${JSON.stringify({
        error: error instanceof Error ? error.message : 'An error occurred'
      })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  }
} 