import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().uuid()
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = paramsSchema.parse(params);

    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        regulation:regulations(id, name),
        chapter:chapters(id, chapter_number, title),
        paragraphs(
          id,
          paragraph_number,
          content_full,
          chapeau,
          subparagraphs(
            id,
            subparagraph_id,
            content,
            type,
            order_index
          )
        ),
        referenced_by:legal_references(
          id,
          source_type,
          source_article,
          source_paragraph,
          source_subparagraph,
          reference_type,
          target_type,
          target_regulation,
          target_article,
          target_paragraph,
          target_subparagraph,
          target_point,
          context
        ),
        references:legal_references(
          id,
          source_type,
          source_article,
          source_paragraph,
          source_subparagraph,
          reference_type,
          target_type,
          target_regulation,
          target_article,
          target_paragraph,
          target_subparagraph,
          target_point,
          context
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ article: data });
  } catch (error) {
    console.error('Article fetch error:', error);
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch article',
        details: error instanceof z.ZodError ? error.errors : undefined
      },
      { status }
    );
  }
} 