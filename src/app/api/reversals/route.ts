import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';

function isFailureStatus(statusCode: number | null | undefined) {
  if (statusCode == null) return true;
  return statusCode < 200 || statusCode >= 300;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user || !user.permissions?.['approvals']?.read) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));

  // Optional date filters
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const createdAt: any = {};
  if (from) createdAt.gte = new Date(from);
  if (to) createdAt.lte = new Date(to);

  const where: any = {
    AND: [
      Object.keys(createdAt).length ? { createdAt } : {},
      {
        OR: [
          { statusCode: null },
          { statusCode: { lt: 200 } },
          { statusCode: { gte: 300 } },
        ],
      },
    ],
  };

  const [total, txs] = await Promise.all([
    prisma.disbursementTransaction.count({ where }),
    prisma.disbursementTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const ids = txs.map((t) => t.id);
  const reversalLogs = ids.length
    ? await prisma.auditLog.findMany({
        where: {
          action: 'DISBURSEMENT_REVERSED',
          entity: 'DisbursementTransaction',
          entityId: { in: ids },
        },
        select: { entityId: true, createdAt: true, actorId: true },
      })
    : [];

  const pendingRequests = ids.length
    ? await prisma.pendingChange.findMany({
        where: {
          status: 'PENDING',
          entityType: 'DisbursementReversal',
          entityId: { in: ids },
        },
        select: { id: true, entityId: true, createdAt: true, createdById: true },
      })
    : [];

  const reversalById = new Map<string, { reversedAt: string; reversedBy: string }>();
  for (const r of reversalLogs) {
    if (!r.entityId) continue;
    reversalById.set(r.entityId, { reversedAt: r.createdAt.toISOString(), reversedBy: r.actorId });
  }

  const pendingByTxId = new Map<string, { changeId: string; requestedAt: string; requestedBy: string }>();
  for (const p of pendingRequests) {
    if (!p.entityId) continue;
    pendingByTxId.set(p.entityId, {
      changeId: p.id,
      requestedAt: p.createdAt.toISOString(),
      requestedBy: p.createdById,
    });
  }

  // Try to resolve borrowerId + loanId for convenience in UI
  const creditAccounts = Array.from(new Set(txs.map((t) => t.creditAccount).filter(Boolean)));
  const phoneMaps = creditAccounts.length
    ? await prisma.phoneAccount.findMany({
        where: { accountNumber: { in: creditAccounts } },
        select: { accountNumber: true, phoneNumber: true },
      })
    : [];
  const phoneByAccount = new Map<string, string>();
  for (const p of phoneMaps) phoneByAccount.set(p.accountNumber, p.phoneNumber);

  const rows = await Promise.all(
    txs.map(async (t) => {
      const reversed = reversalById.get(t.id) ?? null;
      const borrowerId = phoneByAccount.get(t.creditAccount) ?? null;

      // best-effort loan resolution
      let loanId: string | null = null;
      if (borrowerId && t.amount != null) {
        const internalProviderId = t.originalProviderId || t.providerId;
        const windowStart = new Date(t.createdAt.getTime() - 60 * 60 * 1000);
        const windowEnd = new Date(t.createdAt.getTime() + 60 * 60 * 1000);

        const loan = await prisma.loan.findFirst({
          where: {
            borrowerId,
            loanAmount: Number(t.amount),
            createdAt: { gte: windowStart, lte: windowEnd },
            product: { providerId: internalProviderId },
          },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        });
        loanId = loan?.id ?? null;
      }

      return {
        id: t.id,
        transactionId: t.transactionId,
        providerId: t.providerId,
        originalProviderId: t.originalProviderId,
        creditAccount: t.creditAccount,
        amount: t.amount,
        statusCode: t.statusCode,
        createdAt: t.createdAt.toISOString(),
        borrowerId,
        loanId,
        reversed,
        pendingApproval: pendingByTxId.get(t.id) ?? null,
        isFailure: isFailureStatus(t.statusCode),
      };
    }),
  );

  return NextResponse.json({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    rows,
  });
}
