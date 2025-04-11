import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Article, Reference, ReferencePoint } from '@/types/domain/article';
import { SearchHighlight } from '@/types/search/result';

export interface ArticleCardProps {
  article: Article;
  onClose?: () => void;
  onReferenceClick: (reference: Reference) => void;
  isPreview?: boolean;
  similarityThreshold?: number;
  highlights?: SearchHighlight[];
}

interface ReferenceGroup {
  refs: Reference[];
  paragraphs: Set<string>;
  subparagraphs: Set<string>;
}

interface ReferenceToGroup {
  refs: Reference[];
  paragraphs: Set<string>;
  points: Set<string>;
  regulation?: string;
  article_number: string;
}

export function ArticleCard({
  article,
  onClose,
  onReferenceClick,
  isPreview = false,
  similarityThreshold = 0.7,
  highlights
}: ArticleCardProps) {
  // テキストのレンダリング関数
  const renderTextWithReferences = (text: string, references: Reference[]): React.ReactNode => {
    if (!text) return null;

    // 参照情報でテキストを分割
    const parts = text.split(/(\([Aa]rticle \d+[^)]*\))/g);
    return parts.map((part, index) => {
      if (part.match(/^\([Aa]rticle \d+[^)]*\)$/)) {
        return (
          <span key={index} className="text-blue-600 dark:text-blue-400 font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // 参照表示用のヘルパー関数
  const renderReference = (ref: Reference): string => {
    const isInternalReference = ref.type.type === 'internal';

    if (isInternalReference) {
      switch (ref.type.level) {
        case 'article':
          return `Article ${ref.target.article_number} of this Regulation`;
        case 'paragraph':
          return `Article ${ref.target.article_number}${ref.target.paragraph_number ? ` Paragraph ${ref.target.paragraph_number}` : ''} of this Regulation`;
        case 'point':
          return `Point ${ref.target.subparagraph_letter} of Article ${ref.target.article_number} of this Regulation`;
        default:
          return `Article ${ref.target.article_number} of this Regulation`;
      }
    } else {
      return `${ref.type.regulation} Article ${ref.target.article_number}`;
    }
  };

  return (
    <Card className="hover:border-blue-200 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-500">
                {article.regulation_id} | Chapter {article.chapter_id}
              </span>
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Article {article.article_number}: {article.title}
            </h3>
            
            <div className="text-gray-600 mb-4 space-y-4">
              {article.paragraphs ? (
                article.paragraphs.map((paragraph, pIndex) => {
                  const paragraphHighlight = highlights?.find(
                    h => h.type === 'paragraph' && h.path.includes(paragraph.number)
                  );
                  const isHighlighted = paragraphHighlight?.ranges.some(
                    r => r.similarity && r.similarity >= similarityThreshold
                  );
                  
                  return (
                    <div key={pIndex} className={cn(
                      "space-y-2",
                      isHighlighted && "bg-yellow-50 p-2 rounded"
                    )}>
                      <div className="flex gap-2">
                        <span className="font-medium min-w-[2rem]">{paragraph.number}.</span>
                        <div className="flex-1">
                          {renderTextWithReferences(paragraph.content, article.references)}
                          {paragraphHighlight && (
                            <div className="text-sm text-gray-500 mt-1">
                              類似度: {(Math.max(...paragraphHighlight.ranges.map(r => r.similarity || 0)) * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {paragraph.subparagraphs && (
                        <div className="ml-6 space-y-2">
                          {paragraph.subparagraphs.map((subparagraph, sIndex) => {
                            const subparagraphHighlight = highlights?.find(
                              h => h.type === 'subparagraph' && h.path.includes(subparagraph.letter)
                            );
                            
                            return (
                              <div key={sIndex} className="space-y-2">
                                <div className="flex gap-2">
                                  <span className="font-medium min-w-[1.5rem]">({subparagraph.letter})</span>
                                  <div className="flex-1">
                                    {renderTextWithReferences(subparagraph.content, article.references)}
                                    {subparagraphHighlight && (
                                      <div className="text-sm text-gray-500 mt-1">
                                        類似度: {(Math.max(...subparagraphHighlight.ranges.map(r => r.similarity || 0)) * 100).toFixed(1)}%
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                renderTextWithReferences(article.content_full || article.content, article.references)
              )}
            </div>

            {!isPreview && article.references && article.references.length > 0 && (
              <div className="mt-4 space-y-6 border-t pt-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-gray-700">References</h4>
                  <div className="space-y-3">
                    {Array.from(
                      Object.entries(
                        article.references.reduce<Record<string, ReferenceToGroup>>((acc, ref) => {
                          const key = `${ref.type.regulation || 'internal'}-${ref.target.article_number}`;
                          if (!acc[key]) {
                            acc[key] = {
                              refs: [],
                              paragraphs: new Set(),
                              points: new Set(),
                              regulation: ref.type.regulation,
                              article_number: ref.target.article_number || ''
                            };
                          }
                          acc[key].refs.push(ref);
                          if (ref.target.paragraph_number) acc[key].paragraphs.add(ref.target.paragraph_number);
                          if (ref.target.subparagraph_letter) acc[key].points.add(ref.target.subparagraph_letter);
                          return acc;
                        }, {})
                      )
                    ).map(([key, group]) => {
                      const firstRef = group.refs[0];
                      const isInternalReference = firstRef.type.type === 'internal';
                      const content = isInternalReference ? (
                        <button
                          onClick={() => onReferenceClick(firstRef)}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Article {group.article_number}
                          {group.paragraphs.size > 0 && 
                            `(${Array.from(group.paragraphs).join('), (')})`}
                          {group.points.size > 0 && 
                            `(${Array.from(group.points).join('), (')})`}
                        </button>
                      ) : (
                        <span className="font-medium">
                          {group.regulation} Article {group.article_number}
                          {group.paragraphs.size > 0 && 
                            `(${Array.from(group.paragraphs).join('), (')})`}
                          {group.points.size > 0 && 
                            `(${Array.from(group.points).join('), (')})`}
                        </span>
                      );

                      return (
                        <div 
                          key={`ref-to-${article.id}-${key}`}
                          className="text-sm text-gray-600"
                        >
                          {content}
                          {firstRef.context && (
                            <p className="mt-1 text-sm text-gray-500">
                              Context: {firstRef.context}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 