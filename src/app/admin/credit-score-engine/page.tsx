
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
        // Eager loading on the entity will fetch the rules
        const params = await paramRepo.find();
        
        // Map to a serializable format that matches our client-side type
        return params.map(p => ({
            ...p,
            id: String(p.id),
            providerId: String(p.providerId),
            rules: p.rules.map(r => ({ ...r, id: String(r.id) }))
        }));
    } catch(e) {
        console.error(e);
        return [];
    }
}

export default async function CreditScoreEnginePage() {
    const providers = await getProviders();
    const scoringParameters = await getScoringParameters();

    return <CreditScoreEngineClient providers={providers} initialScoringParameters={scoringParameters as any} />;
}
