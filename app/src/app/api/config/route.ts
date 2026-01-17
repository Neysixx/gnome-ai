import { getConfig, updateConfig } from '@/lib/config';
import { NextResponse } from 'next/server';

// Disable caching to always read fresh config from file
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  try {
    const updates = await request.json();
    const newConfig = updateConfig(updates);
    return NextResponse.json(newConfig);
  } catch (error) {
    console.error('Failed to update config:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
