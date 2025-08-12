
import { ScoringEngineClient } from '@/components/admin/scoring-engine-client';
import { prisma } from '@/lib/prisma';
import type { LoanProvider, TransactionProduct } from '@/lib/types';
import { scoringConfigs } from '@/app/api/scoring-configs/route';

async function getProviders(): Promise<LoanProvider[]> {
    const providers = await prisma.loanProvider.findMany({
        include: {
            products: true,
        },
    });
    return providers;
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
async function getScoringConfigs() {
    return scoringConfigs;
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
