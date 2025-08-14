
import { ScoringEngineClient } from '@/components/admin/scoring-engine-client';
import { AppDataSource } from '@/data-source';
import { LoanProvider as LoanProviderEntity } from '@/entities/LoanProvider';
import type { LoanProvider, TransactionProduct, ScoringParameters } from '@/lib/types';


async function getProviders(): Promise<LoanProvider[]> {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const providerRepo = AppDataSource.getRepository(LoanProviderEntity);
    const providers = await providerRepo.find({
        relations: ['products'],
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
            penaltyFee: prod.penaltyFee,
            status: prod.status as 'Active' | 'Disabled',
        }))
    })) as LoanProvider[];
}

// Mocked, as this data doesn't have a source in the current DB schema
async function getTransactionProducts(): Promise<TransactionProduct[]> {
    return [
        { id: 'tp-1', name: 'Top-up' },
        { id: 'tp-2', name: 'Other Bank Transfer' },
        { id: 'tp-3', name: 'Bill Payment' },
    ];
}


// Mocked, as this data doesn't have a source in the current DB schema
async function getScoringConfigs(): Promise<Record<string, ScoringParameters>> {
    // This function returns an empty object because the configs are now managed
    // entirely within the ScoringEngineClient component and its API calls.
    return {};
}


export default async function ScoringEnginePage() {
    const providers = await getProviders();
    const transactionProducts = await getTransactionProducts();
    const scoringConfigs = await getScoringConfigs();

    return (
        <ScoringEngineClient
            providers={providers}
            transactionProducts={transactionProducts}
            initialScoringConfigs={scoringConfigs}
        />
    );
}
