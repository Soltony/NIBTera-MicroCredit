'use server';

import { getUserFromSession } from '@/lib/user';
import prisma from '@/lib/prisma';
import type { PendingChange, User } from '@prisma/client';
import { ReversalApprovalsClient } from './client';

export type PendingReversalApproval = PendingChange & {
  createdBy: Pick<User, 'id' | 'fullName' | 'email' | 'phoneNumber' | 'roleId' | 'loanProviderId' | 'status' | 'passwordChangeRequired' | 'createdAt'>;
  entityName: string;
  providerName?: string;
};

async function getPendingReversalApprovals(): Promise<PendingReversalApproval[]> {
  const changes = await prisma.pendingChange.findMany({
    where: {
      status: 'PENDING',
      entityType: 'DisbursementReversal',
    },
    include: {
      createdBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          roleId: true,
          loanProviderId: true,
          status: true,
          passwordChangeRequired: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const providerIds = changes
    .map((c) => {
      try {
        const data = JSON.parse(c.payload);
        return data?.created?.originalProviderId || data?.created?.providerId || null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const providers = providerIds.length
    ? await prisma.loanProvider.findMany({
        where: { id: { in: providerIds } },
        select: { id: true, name: true },
      })
    : [];

  const providerMap = new Map(providers.map((p) => [p.id, p.name]));

  const detailed = changes.map((change) => {
    let entityName = change.entityId || 'N/A';
    let providerName: string | undefined;

    try {
      const data = JSON.parse(change.payload);
      const created = data?.created;
      if (created) {
        const credit = created.creditAccount ? String(created.creditAccount) : null;
        const txId = created.transactionId ? String(created.transactionId) : null;
        const amount = created.amount != null ? Number(created.amount) : null;
        entityName = [credit ? `Acct ${credit}` : null, txId ? `Txn ${txId}` : null, amount != null ? `Amt ${amount}` : null]
          .filter(Boolean)
          .join(' • ') || entityName;

        const pId = created.originalProviderId || created.providerId;
        if (pId && providerMap.has(pId)) providerName = providerMap.get(pId);
      }
    } catch {
      // ignore
    }

    return {
      ...change,
      entityName,
      providerName,
    } as PendingReversalApproval;
  });

  return detailed;
}

export default async function ReversalApprovalsPage() {
  const user = await getUserFromSession();
  if (!user) return <div>Not authenticated</div>;

  const pendingChanges = await getPendingReversalApprovals();

  return <ReversalApprovalsClient pendingChanges={pendingChanges} currentUser={user} />;
}
