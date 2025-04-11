import { SupabaseClient } from '@supabase/supabase-js';

export type Database = {
  public: {
    Tables: {
      articles: {
        Row: {
          id: string;
          title: string;
          content_full: string;
          article_number: string;
          regulation_id: string;
          chapter_id: string;
          section_id: string | null;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
      };
      chapters: {
        Row: {
          id: string;
          regulation_id: string;
          chapter_number: string;
          title: string;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
      };
      sections: {
        Row: {
          id: string;
          chapter_id: string;
          section_number: string;
          title: string;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};

export type SupabaseClientType = SupabaseClient<Database>; 