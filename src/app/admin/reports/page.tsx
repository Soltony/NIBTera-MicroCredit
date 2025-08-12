
import { ReportsClient } from '@/components/admin/reports-client';
import { prisma } from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import type { LoanDetails as PrismaLoanDetails, Payment } from '@prisma/client';

export interface ReportLoan extends Omit<PrismaLoanDetails, 'payments'> {
    providerName: string;
    productName: string;
    paymentsCount: number;
}

async function getLoanReportData(): Promise<ReportLoan[]> {
    const currentUser = await getUserFromSession();

    const whereClause: any = {};
    if (currentUser?.role === 'Loan Provider' && currentUser.providerId) {
        whereClause.providerId = currentUser.providerId;
    }

    const loans = await prisma.loanDetails.findMany({
        where: whereClause,
        include: {
            provider: true,
            product: true,
            payments: true,
        },
        orderBy: {
            disbursedDate: 'desc',
        },
    });

    const loansToReturn = loans.map(loan => ({
        ...loan,
        providerName: loan.provider.name,
        productName: loan.product.name,
        paymentsCount: loan.payments.length,
    }));
    
    return loansToReturn;
}


export default async function AdminReportsPage() {
    const loans = await getLoanReportData();
    return <ReportsClient initialLoans={loans} />;
}
