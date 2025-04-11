import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ArticleRangeInputProps {
  startArticle: string;
  endArticle: string;
  onStartArticleChange: (value: string) => void;
  onEndArticleChange: (value: string) => void;
  onTypeChange?: (type: 'article' | 'keyword') => void;
}

export function ArticleRangeInput({
  startArticle,
  endArticle,
  onStartArticleChange,
  onEndArticleChange,
  onTypeChange,
}: ArticleRangeInputProps) {
  const handleInputChange = (
    value: string,
    onChange: (value: string) => void
  ) => {
    // 数字とカンマ、スペースのみを許可
    const sanitizedValue = value.replace(/[^0-9,\s]/g, '');
    // 連続したカンマやスペースを1つに
    const normalizedValue = sanitizedValue
      .replace(/,+/g, ',')
      .replace(/\s+/g, ' ')
      .trim();
    onChange(normalizedValue);

    // 条文範囲が入力された場合、検索タイプをarticleに変更
    if (onTypeChange) {
      const hasValue = normalizedValue.length > 0 || 
        (onChange === onStartArticleChange ? endArticle : startArticle).length > 0;
      onTypeChange(hasValue ? 'article' : 'keyword');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          <Label htmlFor="start-article" className="sr-only">開始条文</Label>
          <Input
            id="start-article"
            type="text"
            inputMode="numeric"
            pattern="[0-9,\s]*"
            placeholder="eg., 1, 2, 3"
            value={startArticle}
            onChange={(e) => handleInputChange(e.target.value, onStartArticleChange)}
            aria-label="開始条文番号"
            className="w-full"
          />
        </div>
        <span className="text-gray-500">-</span>
        <div className="flex-1">
          <Label htmlFor="end-article" className="sr-only">終了条文</Label>
          <Input
            id="end-article"
            type="text"
            inputMode="numeric"
            pattern="[0-9,\s]*"
            placeholder="eg., 6"
            value={endArticle}
            onChange={(e) => handleInputChange(e.target.value, onEndArticleChange)}
            aria-label="終了条文番号"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
} 