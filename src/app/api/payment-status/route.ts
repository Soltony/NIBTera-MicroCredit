import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    // Keep this consistent with other mini-app payment routes.
    const session = await getSession();
    if (!session?.superAppToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const transactionId = req.nextUrl.searchParams.get('transactionId');
    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transactionId' }, { status: 400 });
    }

    const pending = await prisma.pendingPayment.findUnique({
      where: { transactionId },
      select: {
        transactionId: true,
        status: true,
        loanId: true,
        amount: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    if (!pending) {
      return NextResponse.json(
        { transactionId, status: 'NOT_FOUND' as const },
        { status: 404 }
      );
    }

    return NextResponse.json(pending, { status: 200 });
  } catch (error: any) {
    console.error('[payment-status] error', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
