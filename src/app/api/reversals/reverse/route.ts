import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import { createAuditLog } from '@/lib/audit-log';

function isFailureStatus(statusCode: number | null | undefined) {
  if (statusCode == null) return true;
  return statusCode < 200 || statusCode >= 300;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user || !user.permissions?.['approvals']?.update) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const ipAddress = (req as any).ip || req.headers.get('x-forwarded-for') || 'N/A';
  const userAgent = req.headers.get('user-agent') || 'N/A';

  const body = await req.json().catch(() => null);
  const disbursementTransactionId = body?.id ? String(body.id) : null;
  if (!disbursementTransactionId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const tx = await prisma.disbursementTransaction.findUnique({ where: { id: disbursementTransactionId } });
  if (!tx) return NextResponse.json({ error: 'DisbursementTransaction not found' }, { status: 404 });

  if (!isFailureStatus(tx.statusCode)) {
    return NextResponse.json({ error: 'This disbursement is not marked as failed; reversal is blocked.' }, { status: 400 });
  }

  const alreadyReversed = await prisma.auditLog.findFirst({
    where: {
      action: 'DISBURSEMENT_REVERSED',
      entity: 'DisbursementTransaction',
      entityId: tx.id,
    },
    select: { id: true },
  });
  if (alreadyReversed) {
    return NextResponse.json({ ok: true, message: 'Already reversed' }, { status: 200 });
  }

  const existingPending = await prisma.pendingChange.findFirst({
    where: {
      status: 'PENDING',
      entityType: 'DisbursementReversal',
      entityId: tx.id,
    },
    select: { id: true },
  });
  if (existingPending) {
    return NextResponse.json({ ok: true, message: 'Already submitted for approval', changeId: existingPending.id }, { status: 200 });
  }

  const payload = JSON.stringify({
    created: {
      disbursementTransactionId: tx.id,
      transactionId: tx.transactionId,
      providerId: tx.providerId,
      originalProviderId: tx.originalProviderId,
      creditAccount: tx.creditAccount,
      amount: tx.amount,
      statusCode: tx.statusCode,
      createdAt: tx.createdAt?.toISOString?.() ?? null,
    },
  });

  const pending = await prisma.pendingChange.create({
    data: {
      entityType: 'DisbursementReversal',
      entityId: tx.id,
      changeType: 'CREATE',
      payload,
      status: 'PENDING',
      createdById: user.id,
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: 'REVERSAL_APPROVAL_REQUESTED',
    entity: 'DisbursementTransaction',
    entityId: tx.id,
    details: { changeId: pending.id, disbursementTransactionId: tx.id },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ ok: true, message: 'Submitted for approval', changeId: pending.id }, { status: 201 });
}
