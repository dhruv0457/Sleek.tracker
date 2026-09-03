import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    mcpVersion: "2024-11-05",
    servers: [
      {
        name: "sleek-mcp-server",
        url: "https://sleek-tracker.vercel.app/api/mcp/sse",
        transport: "sse"
      }
    ]
  });
}
