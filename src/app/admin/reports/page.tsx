

import { ReportsClient } from '@/components/admin/reports-client';
import type { LoanProvider as LoanProviderType, LoanReportData, CollectionsReportData, IncomeReportData } from '@/lib/types';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import { startOfToday, endOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';

export const dynamic = 'force-dynamic';

// This function now simply fetches all providers. 
// The client will handle filtering based on the user's role.
async function getProviders(): Promise<LoanProviderType[]> {
    const providers = await prisma.loanProvider.findMany({
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

    // The component now receives all providers and will filter them on the client-side based on the current user's role.
    const providers = await getProviders();
    
    return <ReportsClient providers={providers} />;
}
