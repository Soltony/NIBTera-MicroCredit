

import { ReportsClient } from '@/components/admin/reports-client';
import type { LoanProvider as LoanProviderType, LoanReportData, CollectionsReportData, IncomeReportData } from '@/lib/types';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import { startOfToday, endOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';

export const dynamic = 'force-dynamic';

async function getProviders(userId: string): Promise<LoanProviderType[]> {
    const user = await getUserFromSession();

    // ONLY Super Admin can see all providers. All other roles are scoped.
    if (user?.role === 'Super Admin') {
        return (await prisma.loanProvider.findMany({
            orderBy: { displayOrder: 'asc' }
        })) as LoanProviderType[];
    }
    
    // For all other users, if they have a providerId, fetch only that one.
    if (user?.loanProviderId) {
        const provider = await prisma.loanProvider.findUnique({
            where: { id: user.loanProviderId }
        });
        return provider ? [provider] as LoanProviderType[] : [];
    }
    
    // If a user has no providerId, they see no providers.
    return [];
}


export default async function AdminReportsPage() {
    const user = await getUserFromSession();
     if (!user) {
        return <div>Not authenticated</div>;
    }

    const providers = await getProviders(user.id);
    
    return <ReportsClient providers={providers} />;
}
