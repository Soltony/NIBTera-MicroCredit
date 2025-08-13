
import { ReportsClient } from '@/components/admin/reports-client';
import { getUserFromSession } from '@/lib/user';
import { AppDataSource } from '@/data-source';
import { LoanDetails } from '@/entities/LoanDetails';
import { LoanProvider as LoanProviderEntity } from '@/entities/LoanProvider';
import type { LoanProvider } from '@/lib/types';
import type { FindOptionsWhere } from 'typeorm';


export interface ReportLoan extends Omit<LoanDetails, 'payments' | 'provider' | 'product' | 'id' | 'providerId' | 'productId' | 'createdAt' | 'updatedAt' > {
    id: string;
    providerName: string;
    productName: string;
    paymentsCount: number;
}

async function getLoanReportData(): Promise<{ loans: ReportLoan[], providers: LoanProvider[] }> {
    const currentUser = await getUserFromSession();
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    
    const loanRepo = AppDataSource.getRepository(LoanDetails);
    const providerRepo = AppDataSource.getRepository(LoanProviderEntity);

    const whereClause: FindOptionsWhere<LoanDetails> = {};
    if (currentUser?.role === 'Loan Provider' && currentUser.providerId) {
        whereClause.providerId = Number(currentUser.providerId);
    }

    const loans = await loanRepo.find({
        where: whereClause,
        relations: ['provider', 'product', 'payments'],
        order: {
            disbursedDate: 'DESC',
        },
    });

    const loansToReturn: ReportLoan[] = loans.map(loan => ({
        id: String(loan.id),
        loanAmount: loan.loanAmount,
        serviceFee: loan.serviceFee,
        interestRate: loan.interestRate,
        disbursedDate: loan.disbursedDate,
        dueDate: loan.dueDate,
        penaltyAmount: loan.penaltyAmount,
        repaymentStatus: loan.repaymentStatus,
        repaidAmount: loan.repaidAmount,
        providerName: loan.provider.name,
        productName: loan.product.name,
        paymentsCount: loan.payments.length,
    }));

    const providers = await providerRepo.find();
    
    return { loans: loansToReturn, providers: providers.map(p => ({ ...p, id: String(p.id) })) as any };
}


export default async function AdminReportsPage() {
    const { loans, providers } = await getLoanReportData();
    return <ReportsClient initialLoans={loans} providers={providers} />;
}
