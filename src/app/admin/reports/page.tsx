
import { ReportsClient } from '@/components/admin/reports-client';
import { prisma } from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import type { LoanDetails as PrismaLoanDetails, Payment, LoanProvider } from '@prisma/client';

export interface ReportLoan extends Omit<PrismaLoanDetails, 'payments'> {
    providerName: string;
    productName: string;
    paymentsCount: number;
}

async function getLoanReportData(): Promise<{ loans: ReportLoan[], providers: LoanProvider[] }> {
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

    const providers = await prisma.loanProvider.findMany();
    
    return { loans: loansToReturn, providers };
}


export default async function AdminReportsPage() {
    const { loans, providers } = await getLoanReportData();
    return <ReportsClient initialLoans={loans} providers={providers} />;
}
