import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/lib/supabase/client';
import { debug, handleSupabaseError, getErrorMessage } from '@/lib/error-handling';

interface RegulationOption {
  id: string;
  name: string;
  official_title: string;
}

interface RegulationSelectProps {
  value?: string;
  onChange: (value: string) => void;
}

export function RegulationSelect({ value, onChange }: RegulationSelectProps) {
  const [regulations, setRegulations] = useState<RegulationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchRegulations() {
      try {
        debug('RegulationSelect', 'Fetching regulations');
        const { data, error } = await supabase
          .from('regulations')
          .select('id, name, official_title')
          .order('name');

        if (error) {
          throw handleSupabaseError(error, 'RegulationSelect');
        }

        debug('RegulationSelect', 'Fetched regulations', data);
        setRegulations(data || []);
      } catch (err) {
        debug('RegulationSelect', 'Error fetching regulations', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchRegulations();
  }, []);

  // 値が変更されたときのデバッグログ
  const handleValueChange = (newValue: string) => {
    debug('RegulationSelect', 'Selected regulation_id:', newValue);
    debug('RegulationSelect', 'Selected regulation:', regulations.find(r => r.id === newValue));
    onChange(newValue);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        <span className="ml-2">loading regulations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 py-2">
        <p>error:</p>
        <p className="text-sm">{getErrorMessage(error)}</p>
      </div>
    );
  }

  if (regulations.length === 0) {
    return <div className="text-gray-500 py-2">Regulation not found</div>;
  }

  // 現在の値のデバッグログ
  debug('RegulationSelect', 'Current value:', value);
  debug('RegulationSelect', 'Available regulations:', regulations);

  return (
    <Select value={value || ''} onValueChange={handleValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Regulation" />
      </SelectTrigger>
      <SelectContent>
        {regulations.map((regulation) => (
          <SelectItem key={regulation.id} value={regulation.id}>
            {regulation.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 