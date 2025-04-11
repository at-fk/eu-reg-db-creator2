'use client';

import { Suspense, useState } from 'react';
import SearchContainer from '../components/search/SearchContainer';
import { AISearchSection } from '../components/search/AISearchSection';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const [showAISearch, setShowAISearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<string>('');
  const [usedContext, setUsedContext] = useState<string | null>(null);

  const handleAISearch = async (params: {
    regulation_id: string;
    query: string;
    similarityThreshold: number;
  }) => {
    try {
      setIsLoading(true);
      setAnswer('');
      setUsedContext(null);

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'semantic',
          regulation_id: params.regulation_id,
          semanticQuery: params.query,
          searchLevel: 'paragraph',
          similarityThreshold: params.similarityThreshold,
          useAllMatches: true,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          const match = line.match(/^data: (.+)$/);
          if (!match) continue;

          const data = match[1].trim();
          if (data === '[DONE]') break;
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'context') {
              setUsedContext(parsed.usedContext);
            } else if (parsed.content) {
              setAnswer(prev => prev + parsed.content);
            } else if (parsed.type === 'done') {
              break;
            }
          } catch (e) {
            console.log('Skipping invalid JSON:', e);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-end mb-4">
          <Button
            onClick={() => setShowAISearch(!showAISearch)}
            variant="outline"
          >
            {showAISearch ? 'Go back to search' : 'AI Answer'}
          </Button>
        </div>

        <Suspense fallback={<div>Loading...</div>}>
          {showAISearch ? (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">AI Answer</h2>
                <p className="text-gray-600">
                  EU regulation content can be answered using AI.
                </p>
              </div>
              <AISearchSection onSearch={handleAISearch} />
              {answer && (
                <div className="space-y-4">
                  <div className="prose max-w-none bg-white p-6 rounded-lg shadow">
                    {answer}
                  </div>
                  {usedContext && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold mb-2">Referenced Context</h3>
                      <pre className="whitespace-pre-wrap text-sm">{usedContext}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <SearchContainer />
          )}
        </Suspense>
      </div>
    </main>
  );
}