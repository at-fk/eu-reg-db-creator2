const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
};

export const apiClient = {
  async generateEmbedding(text: string): Promise<{ embedding: number[] }> {
    const response = await fetch(`${getBaseUrl()}/api/embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate embedding: ${await response.text()}`);
    }

    return response.json();
  }
}; 