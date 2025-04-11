import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SearchResult } from '@/types/domain/search/result';

interface QAContainerProps {
  selectedResults: SearchResult[];
}

export function QAContainer({ selectedResults }: QAContainerProps) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedContext, setUsedContext] = useState<string | null>(null);
  const [isContextDialogOpen, setIsContextDialogOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAnswer('');
    setUsedContext(null);

    if (!query.trim()) {
      setError('Question must be provided');
      return;
    }

    if (selectedResults.length === 0) {
      setError('Search results must be selected');
      return;
    }

    // 前回のリクエストがあればキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          approach: 'context',
          context: selectedResults,
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

      // ストリーミングレスポンスを処理
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 受信したチャンクをデコード
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        // SSEメッセージを処理
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(5);
            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'context') {
                setUsedContext(parsed.usedContext);
              } else if (parsed.content) {
                setAnswer(prev => prev + parsed.content);
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              console.error('Failed to parse SSE message:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // リクエストがキャンセルされた場合は何もしない
        return;
      }
      setError(error instanceof Error ? error.message : 'Answer generation failed');
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your question based on the selected search results"
            disabled={loading}
            className="min-h-[100px]"
          />
        </div>

        <div className="flex space-x-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Generating answer...' : 'Ask a question'}
          </Button>
          {loading && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => abortControllerRef.current?.abort()}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {answer && (
        <div className="space-y-4">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{answer}</ReactMarkdown>
          </div>
          
          <Dialog open={isContextDialogOpen} onOpenChange={setIsContextDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">View Referenced Context</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Referenced Context</DialogTitle>
              </DialogHeader>
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap">{usedContext}</pre>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
} 