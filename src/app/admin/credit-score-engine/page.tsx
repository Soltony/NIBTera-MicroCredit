
import { CreditScoreEngineClient } from '@/components/admin/credit-score-engine-client';

async function getProviders() {
    // Database removed, returning empty array.
    return [];
}

async function getScoringParameters() {
    // Database removed, returning empty array.
    return [];
}

export default async function CreditScoreEnginePage() {
    const providers = await getProviders();
    const scoringParameters = await getScoringParameters();

    return <CreditScoreEngineClient providers={providers} initialScoringParameters={scoringParameters as any} />;
}
