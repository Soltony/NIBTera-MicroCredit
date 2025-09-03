

import { ReportsClient } from '@/components/admin/reports-client';
import type { LoanProvider as LoanProviderType, LoanReportData, CollectionsReportData, IncomeReportData } from '@/lib/types';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import { startOfToday, endOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';

export const dynamic = 'force-dynamic';

async function getProviders(userId: string): Promise<LoanProviderType[]> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { loanProvider: true }
    });

    const isSuperAdminOrAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
    
    const whereClause = isSuperAdminOrAdmin 
        ? {} 
        : { id: user?.loanProvider?.id || '' };

    const providers = await prisma.loanProvider.findMany({
        where: whereClause,
        orderBy: {
            displayOrder: 'asc'
        }
    });

    return providers as LoanProviderType[];
}


export default async function AdminReportsPage() {
    const user = await getUserFromSession();
     if (!user) {
        return <div>Not authenticated</div>;
    }

    const providers = await getProviders(user.id);
    
    return <ReportsClient providers={providers} />;
}
