
import { ReportsClient } from '@/components/admin/reports-client';
import { getUserFromSession } from '@/lib/user';
import { AppDataSource } from '@/data-source';
import { LoanDetails } from '@/entities/LoanDetails';
import { LoanProvider as LoanProviderEntity } from '@/entities/LoanProvider';
import type { LoanProvider } from '@/lib/types';
import type { FindOptionsWhere, DataSource } from 'typeorm';


export interface ReportLoan {
    id: string;
    loanAmount: number;
    serviceFee: number;
    interestRate: number;
    disbursedDate: Date;
    dueDate: Date;
    penaltyAmount: number;
    repaymentStatus: string;
    repaidAmount: number | null;
    providerName: string;
    productName: string;
    paymentsCount: number;
}

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

async function getLoanReportData(): Promise<{ loans: ReportLoan[], providers: LoanProvider[] }> {
    try {
        const currentUser = await getUserFromSession();
        const dataSource = await getConnectedDataSource();
        
        const loanRepo = dataSource.getRepository(LoanDetails);
        const providerRepo = dataSource.getRepository(LoanProviderEntity);

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
            interestRate: 0, // This was missing, let's keep it but maybe it should be calculated.
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
        
        return { 
            loans: loansToReturn, 
            providers: providers.map(p => ({
                id: String(p.id),
                name: p.name,
                icon: p.icon,
                colorHex: p.colorHex,
                displayOrder: p.displayOrder,
                products: []
            })) as any
        };
    } catch(e) {
        console.error(e);
        return { loans: [], providers: [] };
    }
}


export default async function AdminReportsPage() {
    const { loans, providers } = await getLoanReportData();
    return <ReportsClient initialLoans={loans} providers={providers} />;
}
