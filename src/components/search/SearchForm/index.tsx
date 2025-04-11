import { SearchParams } from '@/types/domain/search/params';
import { ArticleRangeInput } from './ArticleRangeInput';
import { RegulationSelect } from './RegulationSelect';
import { SearchInput } from '../SearchInput';
import { SemanticSearchSettings } from './SemanticSearchSettings';
import { Label } from '@/components/ui/label';
import { Button } from "@/components/ui/button";

interface SearchFormProps {
  params: SearchParams;
  onParamsChange: (params: Partial<SearchParams>) => void;
  onSearch: () => void;
  children?: React.ReactNode;
}

export function SearchForm({ params, onParamsChange, onSearch, children }: SearchFormProps) {
  const handleParamsChange = (newParams: Partial<SearchParams>) => {
    onParamsChange({
      ...params,
      ...newParams,
      ...(newParams.type === 'article' ? {
        semanticQuery: '',
        keywordQuery: '',
      } : {}),
    });
  };

  return (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
      className="space-y-4"
    >
      {/* 検索タイプの選択 */}
      <div className="flex space-x-4">
        <div className="flex items-center space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              value="semantic"
              checked={params.type === 'semantic'}
              onChange={(e) => handleParamsChange({ type: e.target.value as SearchParams['type'] })}
              className="form-radio h-4 w-4 text-blue-600"
            />
            <span className="ml-2">Semantic Search</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              value="keyword"
              checked={params.type === 'keyword'}
              onChange={(e) => handleParamsChange({ type: e.target.value as SearchParams['type'] })}
              className="form-radio h-4 w-4 text-blue-600"
            />
            <span className="ml-2">Keyword Search</span>
          </label>
        </div>
      </div>

      {/* 法令選択と条文範囲 */}
      <div className="flex items-start gap-8">
        <div className="flex-1 space-y-2">
          <Label className="text-lg font-semibold">
            Regulation Selection
          </Label>
          <RegulationSelect
            value={params.regulation_id}
            onChange={(value) => handleParamsChange({ regulation_id: value })}
          />
        </div>

        <div className="flex-1 space-y-2">
          <Label className="text-lg font-semibold">
            Article Range (Optional)
          </Label>
          <ArticleRangeInput
            startArticle={params.startArticle || ''}
            endArticle={params.endArticle || ''}
            onStartArticleChange={(value) => handleParamsChange({ startArticle: value })}
            onEndArticleChange={(value) => handleParamsChange({ endArticle: value })}
          />
        </div>
      </div>

      {/* 検索入力部分 */}
      {params.type === 'semantic' ? (
        <div className="space-y-4">
          {/* セマンティック検索の設定 */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">
              Search Settings
            </Label>
            <SemanticSearchSettings
              similarityThreshold={params.similarityThreshold || 0.4}
              useAllMatches={params.useAllMatches || false}
              onSimilarityThresholdChange={(value) => handleParamsChange({ similarityThreshold: value })}
              onUseAllMatchesChange={(value) => handleParamsChange({ useAllMatches: value })}
            />
          </div>

          {/* 意味検索の検索文 */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">
              Search Query
            </Label>
            <div className="flex items-center space-x-4">
              <SearchInput
                value={params.semanticQuery || ''}
                onChange={(value) => handleParamsChange({ semanticQuery: value })}
                onEnter={onSearch}
                placeholder="Natural language search content (e.g., text of the regulation)"
              />
              <Button
                type="submit"
                disabled={!params.semanticQuery}
                className="px-4 py-2"
              >
                Search
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* キーワード検索の入力フィールド */
        <div className="space-y-2">
          <Label className="text-lg font-semibold">
            Keyword
          </Label>
          <div className="flex items-center space-x-4">
            <SearchInput
              value={params.keyword || ''}
              onChange={(value) => handleParamsChange({ keyword: value, keywordQuery: value })}
              onEnter={onSearch}
              placeholder="Keyword"
            />
            <Button
              type="submit"
              className="px-4 py-2"
            >
              Search
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}