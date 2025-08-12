
import { CreditScoreEngineClient } from '@/components/admin/credit-score-engine-client';
import { prisma } from '@/lib/prisma';

async function getProviders() {
    const providers = await prisma.loanProvider.findMany({
        include: {
            products: true,
        },
    });
    return providers;
}

export default async function CreditScoreEnginePage() {
    const providers = await getProviders();
    return <CreditScoreEngineClient providers={providers} />;
}
