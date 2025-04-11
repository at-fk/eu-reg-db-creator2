/**
 * パラグラフを表すインターフェース
 */
export interface Paragraph {
  number: string;
  content: string;
  subparagraphs?: Subparagraph[];
}

/**
 * サブパラグラフを表すインターフェース
 */
export interface Subparagraph {
  letter: string;
  content: string;
}

/**
 * 参照ポイントを表すインターフェース
 */
export interface ReferencePoint {
  regulation_id?: string;
  article_number?: string;
  paragraph_number?: string;
  subparagraph_letter?: string;
}

/**
 * 参照タイプの定義
 */
export type ReferenceType = {
  type: 'internal' | 'external';
  level: 'article' | 'paragraph' | 'point';
  regulation?: string;
}

/**
 * 参照関係を表すインターフェース
 */
export interface Reference {
  type: ReferenceType;
  source: ReferencePoint;
  target: ReferencePoint;
  context?: string;
} 