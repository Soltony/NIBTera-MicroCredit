
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { AppDataSource } from '@/data-source';
import { LoanProvider as LoanProviderEntity } from '@/entities/LoanProvider';
import { LoanDetails as LoanDetailsEntity } from '@/entities/LoanDetails';
import type { LoanDetails, LoanProvider } from '@/lib/types';
import type { DataSource } from 'typeorm';

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

async function getProviders(): Promise<LoanProvider[]> {
    try {
        const dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository(LoanProviderEntity);
        const providers = await providerRepo.find({
            relations: ['products'],
            where: {
                products: {
                    status: 'Active'
                }
            },
            order: {
                displayOrder: 'ASC',
                products: {
                    name: 'ASC'
                }
            }
        });

        // Manually map to plain objects to avoid passing class instances to client components.
        return providers.map(p => ({
            id: String(p.id),
            name: p.name,
            icon: p.icon,
            colorHex: p.colorHex,
            displayOrder: p.displayOrder,
            products: p.products.map(prod => ({
                id: String(prod.id),
                name: prod.name,
                description: prod.description,
                icon: prod.icon,
                minLoan: prod.minLoan,
                maxLoan: prod.maxLoan,
                serviceFee: prod.serviceFee,
                dailyFee: prod.dailyFee,
                penaltyRules: prod.penaltyRules,
                status: prod.status as 'Active' | 'Disabled',
            }))
        })) as LoanProvider[];
    } catch(e) {
        console.error(e);
        return [];
    }
}

async function getLoanHistory(): Promise<LoanDetails[]> {
    try {
        const dataSource = await getConnectedDataSource();
        const loanRepo = dataSource.getRepository(LoanDetailsEntity);
        const loans = await loanRepo.find({
            relations: ['provider', 'product', 'payments'],
            order: {
                disbursedDate: 'DESC',
                payments: {
                    date: 'ASC'
                }
            },
        });

        // Manually map to plain objects to avoid passing class instances to client components.
        return loans.map(loan => ({
            id: String(loan.id),
            providerName: loan.provider.name,
            productName: loan.product.name,
            loanAmount: loan.loanAmount,
            serviceFeeAmount: loan.serviceFeeAmount,
            disbursedDate: loan.disbursedDate,
            dueDate: loan.dueDate,
            repaymentStatus: loan.repaymentStatus as 'Paid' | 'Unpaid',
            repaidAmount: loan.repaidAmount || 0,
            payments: loan.payments.map(p => ({
                amount: p.amount,
                date: p.date,
                outstandingBalanceBeforePayment: p.outstandingBalanceBeforePayment,
            }))
        })) as LoanDetails[];
    } catch(e) {
        console.error(e);
        return [];
    }
}


export default async function LoanPage() {
    const providers = await getProviders();
    const loanHistory = await getLoanHistory();
    
    return <DashboardClient providers={providers} initialLoanHistory={loanHistory} />;
}
