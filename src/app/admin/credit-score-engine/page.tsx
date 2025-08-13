
import { CreditScoreEngineClient } from '@/components/admin/credit-score-engine-client';
import { AppDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import { ScoringParameter } from '@/entities/ScoringParameter';
import type { ScoringParameter as ScoringParameterType } from '@/lib/types';


async function getProviders() {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const providerRepo = AppDataSource.getRepository(LoanProvider);
    const providers = await providerRepo.find({
        relations: ['products'],
    });
    return providers.map(p => ({
        ...p,
        id: String(p.id),
        products: p.products.map(prod => ({...prod, id: String(prod.id)}))
    })) as any[];
}

async function getScoringParameters() {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const paramRepo = AppDataSource.getRepository(ScoringParameter);
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
}

// History is not yet implemented with TypeORM entities in a way that can be easily seeded or fetched.
// This will be adjusted once the entities are in place. For now, returning an empty array.
async function getHistory() {
    return [];
}


export default async function CreditScoreEnginePage() {
    const providers = await getProviders();
    const scoringParameters = await getScoringParameters() as ScoringParameterType[];
    const history = await getHistory();

    return <CreditScoreEngineClient providers={providers} initialScoringParameters={scoringParameters} initialHistory={history as any} />;
}
