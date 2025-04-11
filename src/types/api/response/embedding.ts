import { BaseAPIResponse } from '../../common/base';

export type EmbeddingResponse = BaseAPIResponse<{
  data: {
    embedding: number[];
  }[];
}>; 