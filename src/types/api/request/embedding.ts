export interface EmbeddingRequest {
  input: string[];
  model?: string;
  dimensions?: number;
}

export interface EmbeddingAPIRequest {
  input: string;
} 