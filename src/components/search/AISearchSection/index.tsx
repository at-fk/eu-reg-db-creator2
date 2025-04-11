'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RegulationSelect } from '../SearchForm/RegulationSelect';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { ResponseLanguage } from '@/lib/ai/createOpenAIChatCompletion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AISearchSectionProps {
  onSearch: (params: {
    regulation_id: string;
    query: string;
    searchLevel: 'article' | 'paragraph';
    similarityThreshold: number;
  }) => void;
}

export function AISearchSection({ onSearch }: AISearchSectionProps) {
  const [regulationId, setRegulationId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.3);
  const [answer, setAnswer] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxContexts, setMaxContexts] = useState(10);
  const [usedContext, setUsedContext] = useState<string | null>(null);
  const [isContextDialogOpen, setIsContextDialogOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguage>('en');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regulationId || !query) return;

    setLoading(true);
    setError(null);
    setAnswer('');
    setUsedContext(null);

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ask/semantic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          searchParams: {
            regulation_id: regulationId,
            searchLevel: 'paragraph',
            similarityThreshold,
            maxContexts,
          },
          language: responseLanguage,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Answer generation failed');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming response reading failed');
      }

      // 検索結果を更新
      onSearch({
        regulation_id: regulationId,
        query,
        searchLevel: 'paragraph',
        similarityThreshold,
      });

      let buffer = '';  // 不完全なチャンクを保持するバッファ

      // ストリーミングレスポンスを処理
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 受信したチャンクをデコード
        const chunk = new TextDecoder().decode(value);
        buffer += chunk;

        // 完全なメッセージを処理
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 最後の不完全な行をバッファに保持

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          // SSEメッセージのフォーマットをチェック
          const match = line.match(/^data: (.+)$/);
          if (!match) continue;

          try {
            const data = match[1].trim();
            if (data === '[DONE]') {
              break;
            }

            // 空のデータをスキップ
            if (!data) continue;

            // エラーメッセージのデバッグ用（開発環境のみ）
            if (process.env.NODE_ENV === 'development') {
              console.debug('Received data:', data);
            }

            try {
              const parsed = JSON.parse(data);
              
              // レスポンスの型に応じた処理
              if (parsed.type === 'context' && parsed.usedContext) {
                setUsedContext(parsed.usedContext);
              } else if (parsed.content) {
                setAnswer(prev => prev + parsed.content);
              } else if (parsed.error) {
                throw new Error(parsed.error);
              } else if (parsed.type === 'done') {
                break;
              }
            } catch (parseError) {
              // 開発環境でのみエラーを表示
              if (process.env.NODE_ENV === 'development') {
                console.debug('JSON parse error:', parseError, 'Raw data:', data);
              }
              continue;
            }
          } catch (e) {
            // 重大なエラーのみをユーザーに表示
            if (e instanceof Error) {
              if (e.message.includes('No relevant content found')) {
                setError('関連する内容が見つかりませんでした。検索条件を変更してお試しください。');
              } else if (e.message.includes('No content above similarity threshold')) {
                setError('類似度閾値を超える内容が見つかりませんでした。閾値を下げてお試しください。');
              } else if (e.message.includes('AbortError')) {
                // リクエストがキャンセルされた場合は何もしない
                return;
              } else {
                // その他の重大なエラーのみをユーザーに表示
                setError(`エラーが発生しました: ${e.message}`);
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // リクエストがキャンセルされた場合は何もしない
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Answer generation failed';
      console.error('AI search error:', errorMessage);
      
      // エラーメッセージをユーザーフレンドリーに変換
      let userMessage = 'Error occurred.';
      if (errorMessage.includes('No relevant content found')) {
        userMessage = 'No relevant content found. Please try changing the search conditions.';
      } else if (errorMessage.includes('No content above similarity threshold')) {
        userMessage = 'No content above similarity threshold. Please try lowering the threshold.';
      } else {
        userMessage = `Error: ${errorMessage}`;
      }
      setError(userMessage);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-lg font-semibold">Regulation Selection</Label>
          <RegulationSelect
            value={regulationId}
            onChange={setRegulationId}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-lg font-semibold">Question Content</Label>
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Question must be provided"
            disabled={loading}
            className="min-h-[100px]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-lg font-semibold">Search Settings</Label>
          <div className="space-y-4">
            <div>
              <Label>Similarity Threshold: {similarityThreshold * 100}%</Label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                className="w-full mt-2"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Number of Contexts to Reference (Max 30)</Label>
          <Slider
            value={[maxContexts]}
            onValueChange={(values: number[]) => setMaxContexts(values[0])}
            min={1}
            max={30}
            step={1}
          />
          <div className="text-sm text-gray-500">
            Current setting: {maxContexts} contexts
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-lg font-semibold">Response Language</Label>
          <RadioGroup
            value={responseLanguage}
            onValueChange={(value) => setResponseLanguage(value as ResponseLanguage)}
            className="flex space-x-4 mt-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ja" id="ja" />
              <Label htmlFor="ja">日本語</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="en" id="en" />
              <Label htmlFor="en">English</Label>
            </div>
          </RadioGroup>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? 'Generating answer...' : 'Ask a question'}
        </Button>
        {loading && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => abortControllerRef.current?.abort()}
            className="ml-2"
          >
            Cancel
          </Button>
        )}
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {answer && (
        <div className="space-y-4">
          <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded-lg">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
          
          <Dialog open={isContextDialogOpen} onOpenChange={setIsContextDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">View Referenced Context</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Referenced Context</DialogTitle>
              </DialogHeader>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap">{usedContext}</pre>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
