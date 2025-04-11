'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase/index';
import { handleSupabaseError } from '@/lib/error-handling';

interface ChapterData {
  id: string;
  chapter_number: string;
  title: string;
  sections: SectionData[];
  articles: ArticleData[];
}

interface SectionData {
  id: string;
  section_number: string;
  title: string;
  articles: ArticleData[];
}

interface ArticleData {
  id: string;
  article_number: string;
  title: string;
}

interface RegulationStructureProps {
  regulationId: string | null;
  onStructureClick: (type: 'chapter' | 'section', id: string) => void;
  onArticleClick: (articleId: string) => void;
}

// アルファベット順序の比較関数
const compareArticles = (a: ArticleData, b: ArticleData): number => {
  const aNum = parseInt(a.article_number.replace(/[^0-9]/g, ''));
  const bNum = parseInt(b.article_number.replace(/[^0-9]/g, ''));
  if (aNum !== bNum) return aNum - bNum;
  
  // 数字が同じ場合は、アルファベット部分で比較
  const aAlpha = a.article_number.replace(/[0-9]/g, '');
  const bAlpha = b.article_number.replace(/[0-9]/g, '');
  return aAlpha.localeCompare(bAlpha);
};

export function RegulationStructure({ regulationId, onStructureClick, onArticleClick }: RegulationStructureProps) {
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStructure() {
      if (!regulationId) {
        setChapters([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Chaptersの取得
        const { data: chaptersData, error: chaptersError } = await supabase
          .from('chapters')
          .select('id, chapter_number, title')
          .eq('regulation_id', regulationId)
          .order('order_index');

        if (chaptersError) throw handleSupabaseError(chaptersError, 'RegulationStructure');

        // 各Chapterに対応するSectionsとArticlesの取得
        const chaptersWithContent = await Promise.all(
          (chaptersData || []).map(async (chapter) => {
            // Chapterに直接属するArticlesの取得
            const { data: chapterArticlesData, error: chapterArticlesError } = await supabase
              .from('articles')
              .select('id, article_number, title')
              .eq('chapter_id', chapter.id)
              .is('section_id', null)
              .order('order_index');

            if (chapterArticlesError) throw handleSupabaseError(chapterArticlesError, 'RegulationStructure');

            // Sectionsの取得
            const { data: sectionsData, error: sectionsError } = await supabase
              .from('sections')
              .select('id, section_number, title')
              .eq('chapter_id', chapter.id)
              .order('order_index');

            if (sectionsError) throw handleSupabaseError(sectionsError, 'RegulationStructure');

            // 各Sectionに対応するArticlesの取得
            const sectionsWithArticles = await Promise.all(
              (sectionsData || []).map(async (section) => {
                const { data: sectionArticlesData, error: sectionArticlesError } = await supabase
                  .from('articles')
                  .select('id, article_number, title')
                  .eq('section_id', section.id)
                  .order('order_index');

                if (sectionArticlesError) throw handleSupabaseError(sectionArticlesError, 'RegulationStructure');

                return {
                  ...section,
                  articles: (sectionArticlesData || []).sort(compareArticles),
                };
              })
            );

            return {
              ...chapter,
              sections: sectionsWithArticles,
              articles: (chapterArticlesData || []).sort(compareArticles),
            };
          })
        );

        setChapters(chaptersWithContent);
      } catch (err) {
        setError(err instanceof Error ? err.message : '構造の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    }

    fetchStructure();
  }, [regulationId]);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  if (!regulationId) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2 text-sm">
      <h3 className="font-semibold text-base mb-4">法令の構成</h3>
      {chapters.map((chapter) => (
        <div key={chapter.id} className="space-y-1">
          <div
            className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded"
            onClick={() => {
              toggleChapter(chapter.id);
              onStructureClick('chapter', chapter.id);
            }}
          >
            {(chapter.sections.length > 0 || chapter.articles.length > 0) ? (
              expandedChapters.has(chapter.id) ? (
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
              )
            ) : (
              <div className="w-3.5 flex-shrink-0" />
            )}
            <span className="font-medium">
              Chapter {chapter.chapter_number}: {chapter.title}
            </span>
          </div>
          
          {expandedChapters.has(chapter.id) && (
            <div className="ml-4 space-y-1">
              {/* Chapterに直接属するArticles */}
              {chapter.articles.length > 0 && (
                <div className="space-y-1">
                  {chapter.articles.map((article) => (
                    <div
                      key={article.id}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded text-gray-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onArticleClick(article.id);
                      }}
                    >
                      <div className="w-3.5 flex-shrink-0" />
                      <span>
                        Article {article.article_number}: {article.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Sections */}
              {chapter.sections.map((section) => (
                <div key={section.id} className="space-y-1">
                  <div
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded"
                    onClick={() => {
                      toggleSection(section.id);
                      onStructureClick('section', section.id);
                    }}
                  >
                    {section.articles.length > 0 ? (
                      expandedSections.has(section.id) ? (
                        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                      )
                    ) : (
                      <div className="w-3.5 flex-shrink-0" />
                    )}
                    <span>
                      Section {section.section_number}: {section.title}
                    </span>
                  </div>

                  {expandedSections.has(section.id) && section.articles.length > 0 && (
                    <div className="ml-4 space-y-1">
                      {section.articles.map((article) => (
                        <div
                          key={article.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded text-gray-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            onArticleClick(article.id);
                          }}
                        >
                          <div className="w-3.5 flex-shrink-0" />
                          <span>
                            Article {article.article_number}: {article.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 