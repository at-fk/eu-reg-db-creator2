import { BaseEntity } from '../../common/base';
import { Paragraph } from './paragraph';
import { Reference } from './reference';

/**
 * 条文を表すインターフェース
 */
export interface Article extends BaseEntity {
  article_number: string;
  title: string;
  content: string;
  regulation_id: string;
  chapter_id?: string;
  paragraphs: Paragraph[];
  references: Reference[];
  content_full?: string;
}

export type { Paragraph } from './paragraph';
export type { Reference, ReferencePoint } from './reference'; 