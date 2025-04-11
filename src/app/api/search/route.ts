import { NextRequest, NextResponse } from 'next/server';
import { UnifiedSearchService } from '@/services/search/unified-search';
import { SearchError } from '@/lib/error-handling';
import { SearchParams } from '@/types/domain/search/params';
import { KeywordSearchService } from '@/services/search/keyword-search';

export async function POST(request: NextRequest) {
  try {
    const params = await request.json() as SearchParams;
    console.log('Search params received:', params);
    
    const searchService = new UnifiedSearchService();
    const searchResults = await searchService.search(params);
    console.log('Search results:', searchResults);
    
    return NextResponse.json(searchResults);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({
      data: null,
      error: error instanceof Error ? error.message : 'Search failed'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const keyword = searchParams.get('keyword');
  const startArticle = searchParams.get('startArticle');
  const endArticle = searchParams.get('endArticle');
  const regulationId = searchParams.get('regulation_id');
  
  // キーワードが空でも、条文番号が指定されている場合は検索を実行
  const searchService = new KeywordSearchService();
  const result = await searchService.search({
    keyword: keyword || '',
    startArticle: startArticle || undefined,
    endArticle: endArticle || undefined,
    regulation_id: regulationId || '',
    type: 'keyword'
  });

  return NextResponse.json(result);
} 