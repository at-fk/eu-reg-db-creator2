import { BaseEntity } from '../../common/base';

/**
 * 法令を表すインターフェース
 */
export interface Regulation extends BaseEntity {
  name: string;
  official_title: string;
  short_title: string;
  description?: string;
} 