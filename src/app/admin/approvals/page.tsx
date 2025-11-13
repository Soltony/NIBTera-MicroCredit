
import { getUserFromSession } from '@/lib/user';
import { ApprovalsClient } from './client';
import prisma from '@/lib/prisma';
import type { PendingChange, User } from '@prisma/client';

export type PendingChangeWithRelations = PendingChange & { createdBy: User };

async function getPendingChanges(): Promise<PendingChangeWithRelations[]> {
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
    return changes as PendingChangeWithRelations[];
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
