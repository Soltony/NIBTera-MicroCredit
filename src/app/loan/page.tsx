
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { AppDataSource } from '@/data-source';
import { LoanProvider as LoanProviderEntity } from '@/entities/LoanProvider';
import { LoanDetails as LoanDetailsEntity } from '@/entities/LoanDetails';
import type { LoanDetails, LoanProvider } from '@/lib/types';


async function getProviders(): Promise<LoanProvider[]> {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const providerRepo = AppDataSource.getRepository(LoanProviderEntity);
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

    // Convert to plain objects for client component
    return providers.map(p => ({
        ...p,
        id: String(p.id),
        products: p.products.map(prod => ({
            ...prod,
            id: String(prod.id),
            status: prod.status as 'Active' | 'Disabled'
        }))
    })) as any[];
}

async function getLoanHistory(): Promise<LoanDetails[]> {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const loanRepo = AppDataSource.getRepository(LoanDetailsEntity);
    const loans = await loanRepo.find({
        relations: ['provider', 'product', 'payments'],
        order: {
            disbursedDate: 'DESC',
            payments: {
                date: 'ASC'
            }
        },
    });

    // Convert to plain objects for client component
    return loans.map(loan => ({
        ...loan,
        id: String(loan.id),
        providerName: loan.provider.name,
        productName: loan.product.name,
        payments: loan.payments.map(p => ({...p}))
    })) as any[];
}


export default async function LoanPage() {
    const providers = await getProviders();
    const loanHistory = await getLoanHistory();
    
    return <DashboardClient providers={providers} initialLoanHistory={loanHistory} />;
}
