
import { ReportsClient } from '@/components/admin/reports-client';
import type { LoanProvider as LoanProviderType } from '@/lib/types';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';

export const dynamic = 'force-dynamic';

export interface ReportLoan {
    id: string;
    loanAmount: number;
    serviceFee: number;
    interestRate: number; // Note: We don't store a single rate, this will be indicative.
    disbursedDate: Date;
    dueDate: Date;
    penaltyAmount: number;
    repaymentStatus: string;
    repaidAmount: number | null;
    providerName: string;
    productName: string;
    paymentsCount: number;
}

async function getLoanReportData(userId: string): Promise<{ loans: ReportLoan[], providers: LoanProviderType[] }> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { loanProvider: true }
    });

    const isSuperAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
    
    const whereClause = isSuperAdmin 
        ? {} 
        : { product: { providerId: user?.loanProvider?.id }};

    const loans = await prisma.loan.findMany({
        where: whereClause,
        include: {
            product: {
                include: {
                    provider: true
                }
            },
            _count: {
                select: { payments: true }
            }
        },
        orderBy: {
            disbursedDate: 'desc'
        }
    });

    const allProviders = await prisma.loanProvider.findMany();

    return {
        loans: loans.map(l => ({
            id: l.id,
            loanAmount: l.loanAmount,
            serviceFee: l.serviceFee,
            interestRate: 0, // Placeholder, as interest is dynamic daily fee
            disbursedDate: l.disbursedDate,
            dueDate: l.dueDate,
            penaltyAmount: l.penaltyAmount,
            repaymentStatus: l.repaymentStatus,
            repaidAmount: l.repaidAmount,
            providerName: l.product.provider.name,
            productName: l.product.name,
            paymentsCount: l._count.payments,
        })),
        providers: allProviders as LoanProviderType[]
    };
}


export default async function AdminReportsPage() {
    const user = await getUserFromSession();
     if (!user) {
        return <div>Not authenticated</div>;
    }

    const { loans, providers } = await getLoanReportData(user.id);
    return <ReportsClient initialLoans={loans} providers={providers} />;
}
