

import { ReportsClient } from '@/components/admin/reports-client';
import type { LoanProvider as LoanProviderType, LoanReportData, CollectionsReportData, IncomeReportData } from '@/lib/types';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import { startOfToday, endOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';

export const dynamic = 'force-dynamic';

async function getProviders(userId: string): Promise<LoanProviderType[]> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { 
            role: true,
            loanProvider: true 
        }
    });

    const isSuperAdminOrAdmin = user?.role.name === 'Super Admin' || user?.role.name === 'Admin' || user?.role.name === 'Reconciliation';
    
    // If the user is a super admin or has a reconciliation role, they can see all providers.
    if (isSuperAdminOrAdmin) {
        return (await prisma.loanProvider.findMany({
            orderBy: { displayOrder: 'asc' }
        })) as LoanProviderType[];
    } 
    // Otherwise, if they are a user associated with a specific provider, return only that one.
    else if (user?.loanProvider) {
        return [user.loanProvider] as LoanProviderType[];
    }
    
    // If neither, they have no access.
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
