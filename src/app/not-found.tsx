import Link from 'next/link';
import { headers } from 'next/headers';

export default async function NotFound() {
  const headersList = await headers();
  const accept = headersList.get('accept') || '';

  // While Next.js App Router always renders an HTML shell for not-found.tsx,
  // we can at least provide the markdown content inside a pre tag so agents can parse it easily.
  const isAgent = accept.includes('text/markdown') || accept.includes('application/json');

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
      <h1>404 - Not Found</h1>
      <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
{`# 404 Not Found

The path you requested does not exist.

## Useful Links for Agents and Humans
- [API Documentation](/api/docs)
- [Home](/)
- [Sitemap](/sitemap.xml)
- [LLM Instructions](/llms.txt)
`}
      </pre>
      {!isAgent && (
        <div style={{ marginTop: '2rem' }}>
          <Link href="/" style={{ color: 'blue', textDecoration: 'underline' }}>
            Return Home
          </Link>
        </div>
      )}
    </div>
  );
}
