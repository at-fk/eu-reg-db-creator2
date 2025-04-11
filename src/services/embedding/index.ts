import { SearchError } from '@/lib/error-handling';

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch('/api/embedding', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new SearchError(
      error.error?.message || 'Failed to generate embedding',
      'EMBEDDING_ERROR'
    );
  }

  const data = await response.json();
  return data.embedding;
} 