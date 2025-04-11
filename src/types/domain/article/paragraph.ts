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

export interface SelectedParagraph {
  number: string;
  content: string;
}

export interface SelectedContent {
  article_number: string;
  regulation_name: string;
  title: string;
  paragraphs: SelectedParagraph[];
} 