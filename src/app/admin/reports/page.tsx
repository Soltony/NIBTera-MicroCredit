
import { ReportsClient } from '@/components/admin/reports-client';
import type { LoanProvider as LoanProviderType } from '@/lib/types';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import { toCamelCase } from '@/lib/utils';

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

export interface BorrowerReportInfo {
    id: string;
    name: string;
    status: string;
    activeLoans: number;
    overdueLoans: number;
}


async function getLoanReportData(userId: string): Promise<{ loans: ReportLoan[], providers: LoanProviderType[] }> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { loanProvider: true }
    });

    const isSuperAdminOrAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
    
    const whereClause = isSuperAdminOrAdmin 
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
        providers: allProviders as LoanProviderType[],
    };
}

async function getBorrowerReportData(userId: string): Promise<BorrowerReportInfo[]> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { loanProvider: true }
    });
    
    const isSuperAdminOrAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
    
    const loanWhereClause = isSuperAdminOrAdmin 
        ? {} 
        : { product: { providerId: user?.loanProvider?.id }};
        
    const borrowers = await prisma.borrower.findMany({
        include: {
            loans: {
                where: loanWhereClause,
            },
            provisionedData: {
                orderBy: {
                    createdAt: 'desc',
                },
                take: 1
            },
        }
    });

    return borrowers.map(b => {
        const name = b.provisionedData[0] ? JSON.parse(b.provisionedData[0].data).fullName || b.id : b.id;
        const activeLoans = b.loans.filter(l => l.repaymentStatus === 'Unpaid').length;
        const overdueLoans = b.loans.filter(l => l.repaymentStatus === 'Unpaid' && new Date(l.dueDate) < new Date()).length;
        return {
            id: b.id,
            name: name,
            status: b.status,
            activeLoans,
            overdueLoans
        };
    });
}


export default async function AdminReportsPage() {
    const user = await getUserFromSession();
     if (!user) {
        return <div>Not authenticated</div>;
    }

    const { loans, providers } = await getLoanReportData(user.id);
    const borrowers = await getBorrowerReportData(user.id);
    return <ReportsClient initialLoans={loans} providers={providers} initialBorrowers={borrowers} />;
}
