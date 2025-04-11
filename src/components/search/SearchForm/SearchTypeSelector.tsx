import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { SearchType } from '@/types/domain/search/params';

interface SearchTypeSelectorProps {
  value: SearchType;
  onChange: (value: SearchType) => void;
}

export function SearchTypeSelector({ value, onChange }: SearchTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>検索タイプ</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="検索タイプを選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="article">条文検索</SelectItem>
          <SelectItem value="keyword">キーワード検索</SelectItem>
          <SelectItem value="semantic">セマンティック検索</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
} 