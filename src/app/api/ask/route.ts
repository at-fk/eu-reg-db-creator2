import { NextRequest, NextResponse } from 'next/server';
import { debug } from '@/lib/error-handling';
import { createOpenAIChatCompletion } from '@/lib/ai/createOpenAIChatCompletion';
import { ResponseLanguage } from '@/lib/ai/createOpenAIChatCompletion';
import { SelectedParagraph, SelectedContent } from '@/types/domain/article/paragraph';

/**
 * 選択済みの検索結果を元にコンテキストを作るためのヘルパー関数
 */
function buildContextStringFromSelectedContents(selectedContents: SelectedContent[]): string {
  // デバッグ用のログ
  console.log('Building context from:', selectedContents);

  // selectedContentsが未定義または空の場合のエラーハンドリング
  if (!selectedContents || !Array.isArray(selectedContents) || selectedContents.length === 0) {
    throw new Error('No content selected');
  }

  const contextString = selectedContents
    .map((item, idx) => {
      // itemが未定義の場合のエラーハンドリング
      if (!item) {
        console.warn(`Skipping undefined item at index ${idx}`);
        return null;
      }

      const articleNum = item.article_number || '(no-article-number)';
      const title = item.title || '(no-title)';
      const regulationName = item.regulation_name || '';
      const paragraphs = item.paragraphs || [];
      
      // 各項目のデバッグ用のログ
      console.log(`Context item ${idx + 1}:`, {
        articleNum,
        title,
        regulationName,
        paragraphs
      });
      
      const paragraphsText = paragraphs
        .map((p: SelectedParagraph) => `Paragraph ${p.number}:\n${p.content}`)
        .join('\n\n');
      
      return [
        `【選択結果${idx + 1}】`,
        regulationName ? `${regulationName}` : '',
        `Article ${articleNum}${title ? `: ${title}` : ''}`,
        paragraphsText
      ].filter(Boolean).join('\n');
    })
    .filter(Boolean) // nullの項目を除外
    .join('\n\n');

  // 最終的なコンテキスト文字列のデバッグ用のログ
  console.log('Final context string:', contextString);

  // コンテキストが空の場合のエラーハンドリング
  if (!contextString.trim()) {
    throw new Error('Generated context is empty');
  }

  return contextString;
}

/**
 * メインのPOSTハンドラ
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const { query, selectedContents, language = 'ja' } = await request.json();

  try {
    // コンテキストを構築
    const contextString = buildContextStringFromSelectedContents(selectedContents);

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

          // OpenAI APIのストリーミングレスポンスを処理
          const completion = createOpenAIChatCompletion(
            query,
            contextString,
            language as ResponseLanguage
          );

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