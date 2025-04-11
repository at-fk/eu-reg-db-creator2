import { BaseEntity } from '../../common/base';

/**
 * 管轄を表すインターフェース
 */
export interface Jurisdiction extends BaseEntity {
  name: string;
  code: string;
  description?: string;
}

/**
 * 管轄タイプの定義
 */
export type JurisdictionType = 'EU' | 'MEMBER_STATE' | 'INTERNATIONAL'; 