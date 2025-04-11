import { BaseAPIResponse } from '../../common/base';
import { Article } from '../../domain/article/article';

export type ArticleResponse = BaseAPIResponse<{
  article: Article;
}>;

export interface ArticleAPIResponse {
  article: Article;
} 