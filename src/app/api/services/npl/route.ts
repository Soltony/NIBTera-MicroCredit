
import { NextRequest, NextResponse } from 'next/server';
import { updateNplStatus } from '@/actions/npl';

export async function POST(req: NextRequest) {
    const CRON_SECRET = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await updateNplStatus();
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to update NPL statuses', details: error.message }, { status: 500 });
    }
}
