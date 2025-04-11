interface EmbeddingResponse {
  data: {
    embedding: number[];
  }[];
}

export async function getEmbedding(input: string): Promise<number[]> {
  const jinaApiKey = process.env.NEXT_PUBLIC_JINA_API_KEY;
  if (!jinaApiKey) {
    throw new Error('JINA API Key is not configured');
  }

  try {
    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jinaApiKey}`
      },
      body: JSON.stringify({
        "model": "jina-embeddings-v3",
        "task": "retrieval.query",
        "late_chunking": false,
        "dimensions": "256",
        "embedding_type": "float",
        "input": [input]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Jina AI API error: ${response.status} ${response.statusText}`);
    }

    const data: EmbeddingResponse = await response.json();
    return data.data[0].embedding;

  } catch (error) {
    console.error('Error getting embedding:', error);
    throw error;
  }
} 