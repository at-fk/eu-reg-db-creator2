export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface BaseSearchParams {
  query?: string;
  limit?: number;
  offset?: number;
}

export interface BaseAPIResponse<T> {
  data: T;
  error: string | null;
}

export class BaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
} 