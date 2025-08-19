
import { CreditScoreEngineClient } from '@/components/admin/credit-score-engine-client';
import { getConnectedDataSource } from '@/data-source';
import type { LoanProvider as LoanProviderType, ScoringParameter as ScoringParameterType } from '@/lib/types';
import type { DataSource } from 'typeorm';

async function getProviders() {
    try {
        const dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository('LoanProvider');
        const providers = await providerRepo.find({
            relations: ['products'],
             order: {
                displayOrder: 'ASC',
            }
        });
        return providers.map(p => ({
            ...p,
            id: String(p.id),
            products: p.products.map(prod => ({
                ...prod,
                id: String(prod.id),
                serviceFee: JSON.parse(prod.serviceFee),
                dailyFee: JSON.parse(prod.dailyFee),
                penaltyRules: JSON.parse(prod.penaltyRules),
            })),
        })) as any[];
    } catch(e) {
        console.error(e);
        return [];
    }
}

async function getScoringParameters() {
    try {
        const dataSource = await getConnectedDataSource();
        const paramRepo = dataSource.getRepository('ScoringParameter');
        const params = await paramRepo.find({
            relations: ['rules'],
        });
        
        // Map to a serializable format that matches our client-side type
        return params.map(p => ({
            id: String(p.id),
            providerId: String(p.providerId),
            name: p.name,
            weight: p.weight,
            rules: p.rules.map(r => ({
                id: String(r.id),
                field: r.field,
                condition: r.condition,
                value: r.value,
                score: r.score,
            })),
        }));
    } catch(e) {
        console.error(e);
        return [];
    }
}

async function getHistory() {
    try {
        const dataSource = await getConnectedDataSource();
        const historyRepo = dataSource.getRepository('ScoringConfigurationHistory');
        const history = await historyRepo.find({
            take: 20, // Fetch more history items if needed
            order: {
                savedAt: 'DESC',
            },
            relations: ['appliedProducts'],
        });
        
        return history.map(h => ({
            id: String(h.id),
            providerId: String(h.providerId),
            parameters: JSON.parse(h.parameters),
            savedAt: h.savedAt.toISOString(),
            appliedProducts: h.appliedProducts.map(p => ({
                id: String(p.id),
                name: p.name,
            })),
        }));

    } catch(e) {
        console.error(e);
        return [];
    }
}


export default async function CreditScoreEnginePage() {
    const providers = await getProviders();
    const scoringParameters = await getScoringParameters() as ScoringParameterType[];
    const history = await getHistory();

    return <CreditScoreEngineClient providers={providers} initialScoringParameters={scoringParameters} initialHistory={history as any} />;
}
