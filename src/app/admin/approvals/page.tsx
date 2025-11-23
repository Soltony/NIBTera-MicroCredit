
'use server';

import { getUserFromSession } from '@/lib/user';
import { ApprovalsClient } from './client';
import prisma from '@/lib/prisma';
import type { PendingChange, User } from '@prisma/client';

export type PendingChangeWithDetails = PendingChange & { 
    createdBy: User,
    entityName: string,
    providerName?: string,
};

async function getPendingChanges(): Promise<PendingChangeWithDetails[]> {
    const changes = await prisma.pendingChange.findMany({
        where: {
            status: 'PENDING',
        },
        include: {
            createdBy: true,
        },
        orderBy: {
            createdAt: 'desc',
        }
    });

    const providerIds = changes
        .map(c => {
            try {
                const data = JSON.parse(c.payload);
                return data.created?.providerId || data.updated?.providerId || data.original?.providerId;
            } catch {
                return null;
            }
        })
        .filter(Boolean);

    const providers = await prisma.loanProvider.findMany({
        where: { id: { in: providerIds } },
        select: { id: true, name: true }
    });
    const providerMap = new Map(providers.map(p => [p.id, p.name]));

    const detailedChanges = changes.map(change => {
        let entityName = change.entityId || 'N/A';
        let providerName: string | undefined = undefined;

        try {
            const data = JSON.parse(change.payload);
            const target = data.created || data.updated || data.original;
            
            if (target) {
                entityName = target.name || change.entityId || 'Unnamed';
                if (change.entityType === 'ScoringRules') {
                    entityName = 'Scoring Rules';
                }
                
                const pId = target.providerId;
                if (pId && providerMap.has(pId)) {
                    providerName = providerMap.get(pId);
                } else if (change.entityType === 'LoanProvider') {
                    providerName = target.name;
                }
            } else if (change.entityType === 'DataProvisioningUpload') {
                entityName = data.created.fileName;
            }

        } catch (e) {
            console.error(`Failed to parse payload for change ${change.id}:`, e);
        }

        return {
            ...change,
            entityName,
            providerName,
        } as PendingChangeWithDetails;
    });

    return detailedChanges;
}

export default async function ApprovalsPage() {
    const user = await getUserFromSession();
    if (!user) {
        return <div>Not authenticated</div>;
    }
    const pendingChanges = await getPendingChanges();
    
    return (
        <ApprovalsClient
            pendingChanges={pendingChanges}
            currentUser={user}
        />
    );
}
