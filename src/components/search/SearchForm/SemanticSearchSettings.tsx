import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SemanticSearchSettingsProps {
  similarityThreshold: number;
  useAllMatches: boolean;
  onSimilarityThresholdChange: (value: number) => void;
  onUseAllMatchesChange: (value: boolean) => void;
}

export function SemanticSearchSettings({
  similarityThreshold,
  useAllMatches,
  onSimilarityThresholdChange,
  onUseAllMatchesChange,
}: SemanticSearchSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-8">
        {/* 類似度閾値の設定 */}
        <div className="flex items-center gap-2">
          <Label className="font-semibold whitespace-nowrap">Similarity Threshold</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={similarityThreshold}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value >= 0 && value <= 1) {
                  onSimilarityThresholdChange(value);
                }
              }}
              min={0}
              max={1}
              step={0.05}
              className="w-20 text-right"
            />
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="cursor-help">
                    <QuestionMarkCircledIcon className="h-4 w-4 text-gray-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="max-w-xs">
                  <p className="text-sm">Set between 0 and 1. Higher values show only results with higher similarity.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}