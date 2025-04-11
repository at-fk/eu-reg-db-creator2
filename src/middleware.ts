import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/search')) {
    try {
      // IPアドレスの取得（X-Forwarded-ForまたはRemote Addressを使用）
      const ip = request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') ||
                '127.0.0.1';

      // レート制限のチェック
      const result = await rateLimit.check(
        ip,
        'search_api',
        { pointsToConsume: 1, intervalInSeconds: 60, points: 30 }
      );

      const response = NextResponse.next();
      
      response.headers.set('X-RateLimit-Limit', result.limit.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      
      return response;
    } catch {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*'
}; 