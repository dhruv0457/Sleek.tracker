import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const accept = request.headers.get('accept') || '';
  
  // If the requester explicitly prefers text/markdown over HTML
  if (accept.includes('text/markdown') && !accept.includes('text/html')) {
    const markdownContent = `# Sleek Tracker

Sleek is a focused, beautiful habit + task tracker.
Lap your past, grow your streaks, and watch a moon rise alongside your consistency.

## Features
- **Calendar**: Your year, at a glance.
- **Streaks**: Missed twice? You broke the chain.
- **Trophies & badges**: Locked. Then glowing.
- **Pixel forest focus**: Plant minutes. Watch them grow.

## Resources
- [API Documentation](/api/docs)
- [OpenAPI Spec](/openapi.json)
- [LLMs.txt](/llms.txt)
`;
    
    return new NextResponse(markdownContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Vary': 'Accept, Accept-Encoding'
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
