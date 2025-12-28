import { getConfig, updateConfig, type AppConfig } from '@/lib/config';
import { NextResponse } from 'next/server';

/**
 * GET /api/config - Get current configuration
 */
export async function GET() {
    try {
        const config = getConfig();
        return NextResponse.json(config);
    } catch (error) {
        console.error('[API] Failed to get config:', error);
        return NextResponse.json({ error: 'Failed to get configuration' }, { status: 500 });
    }
}

/**
 * PATCH /api/config - Update configuration
 */
export async function PATCH(request: Request) {
    try {
        const updates = (await request.json()) as Partial<AppConfig>;
        const newConfig = updateConfig(updates);
        return NextResponse.json(newConfig);
    } catch (error) {
        console.error('[API] Failed to update config:', error);
        return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
    }
}

