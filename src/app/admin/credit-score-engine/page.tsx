
import { CreditScoreEngineClient } from '@/components/admin/credit-score-engine-client';
import { prisma } from '@/lib/prisma';
import type { ScoringParameter, Rule } from '@/lib/types';
import type { ScoringHistoryItem } from '@/components/admin/credit-score-engine-client';

async function getProviders() {
    const providers = await prisma.loanProvider.findMany({
        include: {
            products: true,
        },
    });
    return providers;
}

async function getScoringParameters() {
    const params = await prisma.scoringParameter.findMany({
        include: {
            rules: true,
        },
    });
    // Map to a serializable format that matches our client-side type
    return params.map(p => ({
        id: p.id,
        providerId: p.providerId,
        name: p.name,
        weight: p.weight,
        rules: p.rules.map(r => ({
            id: r.id,
            field: r.field,
            condition: r.condition,
            value: r.value,
            score: r.score,
        })),
    }));
}

async function getHistory(): Promise<ScoringHistoryItem[]> {
    const history = await prisma.scoringConfigurationHistory.findMany({
        take: 5,
        orderBy: {
            savedAt: 'desc',
        },
        include: {
            appliedProducts: {
                select: { name: true }
            }
        }
    });

    return history.map(h => ({
        id: h.id,
        savedAt: h.savedAt,
        // The `parameters` field is stored as JSON, so we need to parse it.
        parameters: JSON.parse(h.parameters as string),
        appliedProducts: h.appliedProducts,
    }));
}


export default async function CreditScoreEnginePage() {
    const providers = await getProviders();
    const scoringParameters = await getScoringParameters();
    const history = await getHistory();

    return <CreditScoreEngineClient providers={providers} initialScoringParameters={scoringParameters} initialHistory={history} />;
}
