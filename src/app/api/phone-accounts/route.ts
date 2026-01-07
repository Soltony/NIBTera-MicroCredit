import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { MiniAppAuthError, requireMiniAppAuthContext } from '@/lib/miniapp-auth';

// GET /api/phone-accounts?phoneNumber=...
export async function GET(req: Request) {
  try {
    const ctx = await requireMiniAppAuthContext();
    const url = new URL(req.url);
    const phoneNumber = url.searchParams.get('phoneNumber');
    if (!phoneNumber) return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });

    if (String(phoneNumber) !== String(ctx.borrowerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const items = await prisma.phoneAccount.findMany({
      where: { phoneNumber },
      orderBy: { isActive: 'desc' },
    });

    // info logging removed

    return NextResponse.json(items);
  } catch (err: any) {
    if (err instanceof MiniAppAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

// POST /api/phone-accounts
// body: { phoneNumber, accountNumber, customerName, isActive }
export async function POST(req: Request) {
  try {
    const ctx = await requireMiniAppAuthContext();
    const body = await req.json();
    const { phoneNumber, accountNumber, customerName, isActive } = body;
    if (!phoneNumber || !accountNumber) return NextResponse.json({ error: 'phoneNumber and accountNumber are required' }, { status: 400 });

    if (String(phoneNumber) !== String(ctx.borrowerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accNum = String(accountNumber);

    // If setting active, deactivate others for this phone first
    return await prisma.$transaction(async (tx) => {
      if (isActive) {
        // deactivating other accounts for this phone (logging removed)
        await tx.phoneAccount.updateMany({ where: { phoneNumber }, data: { isActive: false } });
      }

      const upserted = await tx.phoneAccount.upsert({
        where: { phoneNumber_accountNumber: { phoneNumber, accountNumber: accNum } },
        update: { customerName, isActive: !!isActive },
        create: { phoneNumber, accountNumber: accNum, customerName, isActive: !!isActive },
      });

      // upsert completed (logging removed)

      return NextResponse.json(upserted);
    });
    } catch (err: any) {
    if (err instanceof MiniAppAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // error logging removed
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

// PATCH /api/phone-accounts
// body: { phoneNumber, accountNumber } -> sets that account as active and deactivates others
export async function PATCH(req: Request) {
  try {
    const ctx = await requireMiniAppAuthContext();
    const body = await req.json();
    const { phoneNumber, accountNumber } = body;
    if (!phoneNumber || !accountNumber) return NextResponse.json({ error: 'phoneNumber and accountNumber are required' }, { status: 400 });

    if (String(phoneNumber) !== String(ctx.borrowerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accNum = String(accountNumber);

    const result = await prisma.$transaction(async (tx) => {
      // deactivating other accounts for this phone (logging removed)
      await tx.phoneAccount.updateMany({ where: { phoneNumber }, data: { isActive: false } });
      const updated = await tx.phoneAccount.update({
        where: { phoneNumber_accountNumber: { phoneNumber, accountNumber: accNum } },
        data: { isActive: true },
      });
      // update completed (logging removed)
      return updated;
    });

    return NextResponse.json(result);
    } catch (err: any) {
    if (err instanceof MiniAppAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // error logging removed
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
