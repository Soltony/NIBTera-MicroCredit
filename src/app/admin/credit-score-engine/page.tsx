
import { CreditScoreEngineClient } from '@/components/admin/credit-score-engine-client';
import prisma from '@/lib/prisma';
import type { LoanProvider, ScoringParameter } from '@/lib/types';
import { getServerSession } from 'next-auth';


async function getProviders(userId: string): Promise<LoanProvider[]> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { loanProvider: true }
    });

    const whereClause = (user?.role === 'Super Admin' || user?.role === 'Admin')
        ? {}
        : { id: user?.loanProvider?.id };

    const providers = await prisma.loanProvider.findMany({
        where: whereClause,
        include: {
            products: true,
        },
        orderBy: {
            displayOrder: 'asc'
        }
    });
    return providers as LoanProvider[];
}

async function getScoringParameters(providerIds: string[]): Promise<ScoringParameter[]> {
    const parameters = await prisma.scoringParameter.findMany({
        where: {
            providerId: {
                in: providerIds,
            }
        },
        include: {
            rules: true,
        },
    });
    return parameters as ScoringParameter[];
}


export default async function CreditScoreEnginePage() {
    // Session fetching will be replaced with a real auth solution
    const session = { user: { id: '1' } }; // Mock session
    
    if (!session?.user?.id) {
        return <div>Not authenticated</div>;
    }

    const providers = await getProviders(session.user.id);
    const providerIds = providers.map(p => p.id);
    const scoringParameters = await getScoringParameters(providerIds);

    return <CreditScoreEngineClient providers={providers} initialScoringParameters={scoringParameters} />;
}
