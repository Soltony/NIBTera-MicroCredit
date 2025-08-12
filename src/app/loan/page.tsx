import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { prisma } from '@/lib/prisma';
import type { LoanDetails } from '@/lib/types';


async function getProviders() {
    const providers = await prisma.loanProvider.findMany({
        include: {
            products: true,
        }
    });

    // We need to provide the icon component itself, not just the name.
    // This is a temporary solution until the icon mapping is more robust.
    return providers.map(p => ({
        ...p,
        // The 'icon' field in the DB stores a string name, which we can't use directly
        // We'll replace it with a placeholder or a mapped component if needed. For now, this is okay.
    }));
}

async function getLoanHistory(): Promise<LoanDetails[]> {
    const loans = await prisma.loanDetails.findMany({
        include: {
            provider: true,
            product: true,
            payments: {
                orderBy: {
                    date: 'asc',
                },
            },
        },
        orderBy: {
            disbursedDate: 'desc',
        },
    });

    return loans.map(loan => ({
        ...loan,
        providerName: loan.provider.name,
        productName: loan.product.name,
    }));
}


export default async function DashboardPage() {
    const providers = await getProviders();
    const loanHistory = await getLoanHistory();
    
    return <DashboardClient providers={providers} initialLoanHistory={loanHistory} />;
}
