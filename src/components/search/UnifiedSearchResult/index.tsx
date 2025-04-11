import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { SearchResult, SearchResultParagraph, SearchResultMatch } from '@/types/domain/search/result';
import { Reference } from '@/types/domain/article/reference';
import { Checkbox } from "@/components/ui/checkbox";

interface UnifiedSearchResultCardProps {
  result: SearchResult;
  onClose?: () => void;
  onReferenceClick?: (reference: Reference) => void;
  isPreview?: boolean;
  similarityThreshold?: number;
  isSelected?: boolean;
  onSelect?: (result: SearchResult) => void;
  onAskAI?: (result: SearchResult) => void;
  selectedParagraphs?: string[];
  onParagraphSelect?: (paragraphId: string, isSelected: boolean) => void;
}

// ハイライト用のヘルパー関数を追加
function highlightText(text: string, matches: SearchResultMatch[] = []): React.ReactNode {
  if (!matches || matches.length === 0) return text;

  // マッチ位置でソート
  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);
  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedMatches.forEach((match, index) => {
    // 前のマッチと重複していないか確認
    if (match.start < lastIndex) return;

    // マッチ前のテキストを追加
    if (match.start > lastIndex) {
      result.push(text.slice(lastIndex, match.start));
    }

    // マッチしたテキストをハイライト
    result.push(
      <span key={index} className="bg-yellow-200">
        {text.slice(match.start, match.end)}
      </span>
    );

    lastIndex = match.end;
  });

  // 残りのテキストを追加
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return <>{result}</>;
}

export function UnifiedSearchResultCard({
  result,
  onClose,
  onReferenceClick,
  isPreview = false,
  similarityThreshold = 0.7,
  isSelected = false,
  onSelect,
  onAskAI,
  selectedParagraphs = [],
  onParagraphSelect,
}: UnifiedSearchResultCardProps) {
  const isSemanticSearch = result.metadata.search_type === 'semantic';
  const isKeywordSearch = result.metadata.search_type === 'keyword';
  const isDefinitions = result.debug_info?.article?.is_definitions;

  return (
    <Card className={cn("relative", isSelected && "ring-2 ring-blue-500")}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-500">
                {result.metadata.regulation_name} | {result.metadata.chapter_title}
              </span>
              {isSemanticSearch && result.metadata.similarity_percentage !== undefined && (
                <span className="text-sm text-gray-500">
                  (類似度: {result.metadata.similarity_percentage}%)
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Article {result.metadata.article_number || result.article_number}: {result.title}
            </h3>
            
            <div className="text-gray-600 mb-4 space-y-4">
              {result.paragraphs && result.paragraphs
                .filter(paragraph => paragraph.elements && paragraph.elements.length > 0)
                .map((paragraph: SearchResultParagraph, pIndex: number) => {
                  const paragraphId = `${result.id}-${pIndex}`;
                  const isParagraphSelected = selectedParagraphs.includes(paragraphId);
                  const hasMatches = paragraph.matches && paragraph.matches.length > 0;
                  const hasSimilarity = paragraph.similarity_percentage !== undefined;
                  const isAboveThreshold = paragraph.is_above_threshold ?? 
                    (paragraph.similarity_percentage !== undefined && 
                     paragraph.similarity_percentage >= similarityThreshold * 100);
                  
                  return (
                    <div key={pIndex} className={cn(
                      "relative border rounded p-4",
                      hasSimilarity && "p-2 rounded border-l-4",
                      isAboveThreshold ? "bg-yellow-50 border-yellow-400" : 
                        hasSimilarity ? "bg-gray-50 border-gray-300" : "",
                      isKeywordSearch && hasMatches && "bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded"
                    )}>
                      {/* パラグラフ選択用チェックボックス */}
                      <div className="absolute top-2 right-2">
                        <Checkbox
                          checked={isParagraphSelected}
                          onCheckedChange={(checked) => onParagraphSelect?.(paragraphId, checked as boolean)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[2rem]">{paragraph.number}.</span>
                          <div className="flex-1">
                            {paragraph.elements && paragraph.elements.length > 0 ? (
                              paragraph.elements
                                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                                .map((element, eIndex) => {
                                  const hasElementMatches = element.matches && element.matches.length > 0;
                                  const hasSimilarity = element.similarity_percentage !== undefined;
                                  const isAboveThreshold = element.similarity_percentage !== undefined && 
                                    element.similarity_percentage >= similarityThreshold * 100;
                                  
                                  return (
                                    <div key={eIndex} className={cn(
                                      "flex gap-2",
                                      element.type === 'subparagraph' && "ml-6",
                                      hasSimilarity && "p-2 rounded border-l-4",
                                      isAboveThreshold ? "bg-yellow-50 border-yellow-400" : 
                                        hasSimilarity ? "bg-gray-50 border-gray-300" : "",
                                      isKeywordSearch && hasElementMatches && "bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded"
                                    )}>
                                      {element.type === 'subparagraph' && (
                                        <span className="font-medium min-w-[1.5rem]">({element.letter})</span>
                                      )}
                                      <div className="flex-1">
                                        {isKeywordSearch ? 
                                          highlightText(element.content, element.matches || []) :
                                          element.content
                                        }
                                        {isSemanticSearch && hasSimilarity ? (
                                          <div className={cn(
                                            "text-sm mt-1",
                                            isAboveThreshold ? "text-gray-500" : "text-gray-400"
                                          )}>
                                            類似度: {element.similarity_percentage}%
                                          </div>
                                        ) : (
                                          hasElementMatches && isKeywordSearch && (
                                            <div className="text-sm text-gray-500 mt-1">
                                              マッチ箇所: {element.matches.length}箇所
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                            ) : (
                              <>
                                {paragraph.content && (
                                  <div className="flex-1">
                                    {isKeywordSearch ? 
                                      highlightText(paragraph.content, paragraph.matches || []) :
                                      paragraph.content
                                    }
                                    {isKeywordSearch && hasMatches && (
                                      <div className="text-sm text-gray-500 mt-1">
                                        マッチ箇所: {paragraph.matches.length}箇所
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}