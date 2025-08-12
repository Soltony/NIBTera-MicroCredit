import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { prisma } from '@/lib/prisma';
import type { LoanDetails } from '@/lib/types';


async function getProviders() {
    const providers = await prisma.loanProvider.findMany({
        include: {
            products: {
                 where: { status: 'Active' },
                 orderBy: { name: 'asc' }
            },
        },
        orderBy: {
            displayOrder: 'asc'
        }
    });

    return providers.map(p => ({
        ...p,
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
