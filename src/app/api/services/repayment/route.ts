
import { NextRequest, NextResponse } from 'next/server';
import { processAutomatedRepayments } from '@/actions/repayment';

export async function POST(req: NextRequest) {
    const CRON_SECRET = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await processAutomatedRepayments();
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to process automated repayments', details: error.message }, { status: 500 });
    }
}
