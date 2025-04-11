import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchForm } from './SearchForm';
import { SearchResults } from './UnifiedSearchResult/SearchResults';
import { SearchInput } from './SearchInput';
import { RegulationStructure } from './RegulationStructure';
import { SearchParams } from '@/types/domain/search/params';
import { SearchResult } from '@/types/domain/search/result';
import { useSearch } from '@/lib/hooks/useSearch';
import { debug } from '@/lib/error-handling';
import { supabase } from '@/lib/supabase/client';
import { QAContainer } from './QAContainer';
import { Reference } from '@/types/domain/article/reference';
import { ParagraphElement } from '@/services/search/transformer';
import { SearchResponse } from '@/types/api/response/search';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function SearchContainer() {
  const [params, setParams] = useState<SearchParams>({
    type: 'keyword',
    regulation_id: '',
    startArticle: '',
    endArticle: '',
    keyword: '',
    semanticQuery: '',
  });
  const [responseLanguage, setResponseLanguage] = useState<'ja' | 'en'>('ja');

  const { results, loading: isLoading, error, search: executeSearch } = useSearch();
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [selectedParagraphs, setSelectedParagraphs] = useState<string[]>([]);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiQuery, setAIQuery] = useState('');
  const [aiAnswer, setAIAnswer] = useState<string | null>(null);
  const [aiError, setAIError] = useState<string | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [usedContext, setUsedContext] = useState<string | null>(null);
  const [isContextDialogOpen, setIsContextDialogOpen] = useState(false);
  const [showQAContainer, setShowQAContainer] = useState(false);

  const updateParams = useCallback((newParams: Partial<SearchParams>) => {
    debug('SearchContainer', 'Updating params:', {
      current: params,
      new: newParams,
      merged: { ...params, ...newParams }
    });
    
    setParams(prev => {
      const updatedParams = { ...prev, ...newParams };
      
      // 条文番号のバリデーションと正規化
      if (updatedParams.startArticle) {
        const startNum = parseInt(updatedParams.startArticle);
        if (!isNaN(startNum) && startNum >= 1) {
          updatedParams.startArticle = startNum.toString();
        }
      }
      
      if (updatedParams.endArticle) {
        const endNum = parseInt(updatedParams.endArticle);
        if (!isNaN(endNum) && endNum >= 1) {
          updatedParams.endArticle = endNum.toString();
        }
      }
      
      // キーワードの正規化
      if (typeof updatedParams.keyword === 'string') {
        updatedParams.keyword = updatedParams.keyword;
      }
      
      return updatedParams;
    });
  }, []);

  const handleAISubmit = useCallback(async () => {
    if (!aiQuery || !params.regulation_id || selectedParagraphs.length === 0) {
      return;
    }

    setIsAILoading(true);
    setAIError(null);
    setAIAnswer('');

    try {
      // 選択された条文とパラグラフの内容を取得
      const selectedContents = results
        ?.filter((result: SearchResult) => result.paragraphs?.some((_: any, index: number) => 
          selectedParagraphs.includes(`${result.id}-${index}`)))
        .map((result: SearchResult) => {
          const selectedParagraphsForArticle = result.paragraphs
            ?.filter((_: any, index: number) => selectedParagraphs.includes(`${result.id}-${index}`))
            .map(p => ({
              content: p.elements?.map((e: ParagraphElement) => e.content).join('\n') || p.content || '',
              number: p.number
            })) || [];

          return {
            article_number: result.metadata.article_number,
            regulation_name: result.metadata.regulation_name || '',
            title: result.title,
            paragraphs: selectedParagraphsForArticle
          };
        }) || [];

      // selectedContentsが未定義または空の場合のエラーハンドリング
      if (!selectedContents || selectedContents.length === 0) {
        throw new Error('No content selected');
      }

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: aiQuery,
          selectedContents: selectedContents,
          language: responseLanguage
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming response reading failed');
      }

      // ストリーミングレスポンスを処理
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 受信したチャンクをデコード
        const chunk = new TextDecoder().decode(value);

        // SSEメッセージを処理
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const data = line.slice(5);
              const parsed = JSON.parse(data);

              if (parsed.type === 'context') {
                setUsedContext(parsed.usedContext);
              } else if (parsed.type === 'done') {
                console.log('Stream completed');
                break;
              } else if (parsed.content) {
                setAIAnswer(prev => prev + parsed.content);
              } else if (parsed.error) {
                console.error('Error from server:', parsed.error);
                throw new Error(parsed.error);
              }
            } catch (e) {
              console.error('Failed to parse SSE message:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('AI error:', error);
      setAIError(error instanceof Error ? error.message : 'Failed to get AI response');
    } finally {
      setIsAILoading(false);
    }
  }, [aiQuery, params.regulation_id, selectedParagraphs, results, responseLanguage]);

  const handleStructureClick = useCallback(async (type: 'chapter' | 'section', id: string) => {
    debug('SearchContainer', 'Structure click:', { type, id, regulation_id: params.regulation_id });
    
    // Get the articles in this chapter/section
    const { data: articles } = await supabase
      .from('articles')
      .select('article_number')
      .eq(type === 'chapter' ? 'chapter_id' : 'section_id', id)
      .order('order_index');

    if (articles && articles.length > 0) {
      const articleNumbers = articles.map(a => a.article_number);
      executeSearch({
        type: 'article',
        regulation_id: params.regulation_id,
        startArticle: articleNumbers[0],
        endArticle: articleNumbers[articleNumbers.length - 1]
      } as SearchParams);
    }
  }, [executeSearch, params.regulation_id]);

  const handleArticleClick = useCallback(async (articleId: string) => {
    debug('SearchContainer', 'Article click:', { articleId, regulation_id: params.regulation_id });
    
    // Get the article number for this article
    const { data: article } = await supabase
      .from('articles')
      .select('article_number')
      .eq('id', articleId)
      .single();

    if (article) {
      executeSearch({
        type: 'article',
        regulation_id: params.regulation_id,
        startArticle: article.article_number,
        endArticle: article.article_number
      } as SearchParams);
    }
  }, [executeSearch, params.regulation_id]);

  const handleSearch = useCallback(async () => {
    if (!params.regulation_id) {
      return;
    }

    try {
      await executeSearch(params);
    } catch (error) {
      console.error('Search error:', error);
    }
  }, [params, executeSearch]);

  const handleParagraphSelect = useCallback((paragraphId: string, isSelected: boolean) => {
    setSelectedParagraphs(prev => {
      if (isSelected) {
        return [...prev, paragraphId];
      } else {
        return prev.filter(id => id !== paragraphId);
      }
    });
  }, []);

  // パラグラフの選択情報を含めた結果を生成する関数
  const getSelectedContent = useCallback(() => {
    // 選択されたパラグラフの情報を収集
    const paragraphResults = selectedParagraphs.map(paragraphId => {
      const [resultId, paragraphIndex] = paragraphId.split('-');
      const result = results?.find(r => r.id === resultId);
      if (!result || !result.paragraphs) return null;
      
      const paragraph = result.paragraphs[parseInt(paragraphIndex)];
      if (!paragraph) return null;

      return {
        ...result,
        content: paragraph.elements?.map(e => e.content).join('\n') || '',
        type: 'paragraph' as const
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    return paragraphResults;
  }, [selectedParagraphs, results]);

  const handleAskAI = useCallback(async (results: SearchResult[]) => {
    setIsAIModalOpen(true);
    setAIQuery('');
    setAIAnswer(null);
    setAIError(null);
    setUsedContext(null);
    setShowQAContainer(true);
  }, []);

  const handleCloseAIModal = () => {
    setIsAIModalOpen(false);
    setAIQuery('');
    setAIAnswer(null);
    setAIError(null);
    setUsedContext(null);
    setShowQAContainer(false);
  };

  const handleReferenceClick = (reference: Reference) => {
    // 参照クリック時の処理
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="grid grid-cols-4 gap-6">
        {/* サイドバー */}
        <div className="col-span-1 bg-white rounded-lg shadow">
          <RegulationStructure
            regulationId={params.regulation_id || null}
            onStructureClick={handleStructureClick}
            onArticleClick={handleArticleClick}
          />
        </div>

        {/* メインコンテンツ */}
        <div className="col-span-3 space-y-8">
          <SearchForm
            params={params}
            onParamsChange={updateParams}
            onSearch={handleSearch}
          >
            {params.type === 'keyword' && (
              <SearchInput
                value={params.keyword || ''}
                onChange={(value) => updateParams({ keyword: value })}
                onEnter={handleSearch}
                placeholder="Enter keywords or phrases"
              />
            )}
          </SearchForm>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-800">
              <p>{error.message}</p>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Searching...</p>
            </div>
          ) : (
            results && results.length > 0 && (
              <SearchResults
                results={results}
                selectedResult={selectedResult}
                onResultSelect={setSelectedResult}
                onSelectedResultClose={() => setSelectedResult(null)}
                onReferenceClick={handleReferenceClick}
                searchType={params.type as 'keyword' | 'semantic' | 'article'}
                selectedParagraphs={selectedParagraphs}
                onParagraphSelect={handleParagraphSelect}
                onAskAI={handleAskAI}
              />
            )
          )}

          {showQAContainer && selectedParagraphs.length > 0 && (
            <div className="mt-8 p-6 border rounded-lg bg-white">
              <h2 className="text-xl font-semibold mb-4">Ask AI</h2>
              <QAContainer selectedResults={getSelectedContent()} />
            </div>
          )}
        </div>
      </div>

      {/* AI質問モーダル */}
      <Dialog open={isAIModalOpen} onOpenChange={handleCloseAIModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Ask AI</DialogTitle>
            <DialogDescription>
              AI generates answers based on the selected {selectedParagraphs.length} paragraphs.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 space-y-4 overflow-auto p-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-4 mb-4">
                <Label>Response Language</Label>
                <RadioGroup
                  value={responseLanguage}
                  onValueChange={(value) => setResponseLanguage(value as 'ja' | 'en')}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ja" id="ja" />
                    <Label htmlFor="ja">日本語</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="en" id="en" />
                    <Label htmlFor="en">English</Label>
                  </div>
                </RadioGroup>
              </div>
              <Label>Question</Label>
              <Textarea
                value={aiQuery}
                onChange={(e) => setAIQuery(e.target.value)}
                placeholder="Ask a question about the selected paragraphs"
                className="min-h-[100px] resize-y"
              />
            </div>

            {aiError && (
              <Alert variant="destructive">
                <AlertDescription>{aiError}</AlertDescription>
              </Alert>
            )}

            {aiAnswer && (
              <div className="space-y-2">
                <Label>AI Answer</Label>
                <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded-lg">
                  <ReactMarkdown>{aiAnswer}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {usedContext && (
              <Button
                variant="outline"
                onClick={() => setIsContextDialogOpen(true)}
              >
                Check Referenced Articles
              </Button>
            )}
            <Button
              onClick={handleAISubmit}
              disabled={!aiQuery || isAILoading}
            >
              {isAILoading ? 'Generating...' : 'Ask AI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 参照条文確認モーダル */}
      {usedContext && (
        <Dialog open={isContextDialogOpen} onOpenChange={setIsContextDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Referenced Articles</DialogTitle>
            </DialogHeader>
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-sm">{usedContext}</pre>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}