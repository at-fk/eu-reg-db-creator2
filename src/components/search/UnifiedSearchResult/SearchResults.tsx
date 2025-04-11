import React from 'react';
import { SearchResult } from '@/types/domain/search/result';
import { UnifiedSearchResultCard } from './index';
import { Reference } from '@/types/domain/article/reference';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export interface SearchResultsProps {
  results: SearchResult[];
  selectedResult: SearchResult | null;
  onResultSelect: (result: SearchResult) => void;
  onSelectedResultClose: () => void;
  onReferenceClick?: (reference: Reference) => void;
  similarityThreshold?: number;
  selectedParagraphs: string[];
  onParagraphSelect: (paragraphId: string, isSelected: boolean) => void;
  onAskAI: (selectedResults: SearchResult[]) => Promise<void>;
  searchType: 'keyword' | 'semantic' | 'article';
}

export function SearchResults({
  results,
  selectedResult,
  onResultSelect,
  onSelectedResultClose,
  onReferenceClick,
  similarityThreshold = 0.7,
  selectedParagraphs,
  onParagraphSelect,
  onAskAI,
  searchType,
}: SearchResultsProps) {
  // パラグラフの選択情報を含めた結果を生成する関数
  const getSelectedContent = () => {
    // 選択されたパラグラフの情報を収集
    const paragraphResults = selectedParagraphs.map(paragraphId => {
      const [resultId, paragraphIndex] = paragraphId.split('-');
      const result = results.find(r => r.id === resultId);
      if (!result || !result.paragraphs) return null;
      
      const paragraph = result.paragraphs[parseInt(paragraphIndex)];
      if (!paragraph) return null;

      // パラグラフの内容を構築
      const paragraphContent = paragraph.elements?.map(e => e.content).join('\n') || '';
      
      // デバッグ用のログ
      console.log('Selected paragraph:', {
        resultId,
        paragraphIndex,
        metadata: result.metadata,
        title: result.title,
        paragraph: paragraph,
        content: paragraphContent
      });

      return {
        id: `${result.id}-${paragraphIndex}`,
        metadata: {
          regulation_id: result.metadata?.regulation_id || '',
          regulation_name: result.metadata?.regulation_name || '',
          article_number: result.metadata?.article_number || '',
          chapter_number: result.metadata?.chapter_number || '',
          chapter_title: result.metadata?.chapter_title || '',
        },
        title: result.title || '',
        content: paragraphContent,
        paragraphs: [paragraph],
        type: 'paragraph' as const
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    // デバッグ用のログ
    console.log('Generated context:', paragraphResults);

    return paragraphResults;
  };

  // 条文の全パラグラフを選択/解除する関数
  const handleArticleSelect = (result: SearchResult, isSelected: boolean) => {
    const paragraphIds = result.paragraphs?.map((_, index) => `${result.id}-${index}`) || [];
    paragraphIds.forEach(id => {
      onParagraphSelect(id, isSelected);
    });
  };

  // 条文の選択状態を確認する関数（全パラグラフが選択されているかどうか）
  const isArticleSelected = (result: SearchResult) => {
    const paragraphIds = result.paragraphs?.map((_, index) => `${result.id}-${index}`) || [];
    return paragraphIds.length > 0 && paragraphIds.every(id => selectedParagraphs.includes(id));
  };

  const handleSendAllToAI = () => {
    // For keyword search, extract paragraphs containing keywords
    if (searchType === 'keyword') {
      const paragraphResults = results.flatMap(result => {
        const paragraphs = result.paragraphs || [];
        return paragraphs
          .filter(p => p.matches && p.matches.length > 0)
          .map(p => ({
            ...result,
            content: p.elements?.map(e => e.content).join('\n') || '',
            type: 'paragraph' as const
          }));
      });
      onAskAI?.(paragraphResults);
    } else {
      // For semantic search, use paragraphs above threshold
      const paragraphResults = results.flatMap(result => {
        const paragraphs = result.paragraphs || [];
        return paragraphs
          .filter(p => p.is_above_threshold)
          .map(p => ({
            ...result,
            content: p.elements?.map(e => e.content).join('\n') || '',
            type: 'paragraph' as const
          }));
      });
      onAskAI?.(paragraphResults);
    }
  };

  return (
    <div className="space-y-4">
      {/* 選択された検索結果に対するアクション - 固定位置に */}
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        {selectedParagraphs.length > 0 && onAskAI && (
          <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <span>Choosen paragraphs: {selectedParagraphs.length}</span>
            </div>
            <button
              onClick={() => onAskAI(getSelectedContent())}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Ask AI about choosen paragraphs
            </button>
          </div>
        )}
      </div>

      {/* 検索結果カード */}
      {results.map((result) => (
        <div 
          key={result.id} 
          className="relative border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="absolute top-4 right-4 flex items-center space-x-2">
            <Checkbox
              checked={isArticleSelected(result)}
              onCheckedChange={(checked) => handleArticleSelect(result, checked as boolean)}
            />
          </div>
          <div className="p-4">
            <UnifiedSearchResultCard
              result={result}
              isPreview
              isSelected={isArticleSelected(result)}
              onReferenceClick={onReferenceClick}
              selectedParagraphs={selectedParagraphs}
              onParagraphSelect={onParagraphSelect}
            />
          </div>
        </div>
      ))}

      {/* 選択された結果の詳細表示 */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-4">
              <UnifiedSearchResultCard
                result={selectedResult}
                onClose={onSelectedResultClose}
                onReferenceClick={onReferenceClick}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}