

import { CreditScoreEngineClient } from '@/components/admin/credit-score-engine-client';
import prisma from '@/lib/prisma';
import type { LoanProvider, ScoringParameter } from '@/lib/types';
import { getUserFromSession } from '@/lib/user';


async function getProviders(userId: string): Promise<LoanProvider[]> {
    const user = await getUserFromSession();

    // Only Super Admin can see and manage all providers.
    // Other roles are scoped to their own provider if they have one.
    const whereClause = (user?.role === 'Super Admin')
        ? {}
        : { id: user?.loanProviderId || '---NO_PROVIDER---' }; // Use an impossible ID if no providerId


    const providers = await prisma.loanProvider.findMany({
        where: whereClause,
        include: {
            products: {
                select: {
                    id: true,
                    name: true,
                    eligibilityUploadId: true,
                }
            },
            dataProvisioningConfigs: {
                 include: {
                    uploads: {
                        orderBy: {
                            uploadedAt: 'desc'
                        }
                    }
                }
            }
        },
        orderBy: {
            displayOrder: 'asc'
        }
    });

    const safeJsonParse = (jsonString: string | null | undefined, defaultValue: any) => {
        if (!jsonString) return defaultValue;
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            return defaultValue;
        }
    };
    
    return providers.map(p => ({
        ...p,
        dataProvisioningConfigs: (p.dataProvisioningConfigs || []).map(config => ({
            ...config,
            columns: safeJsonParse(config.columns as string, [])
        }))
    })) as LoanProvider[];
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
    const user = await getUserFromSession();
    
    if (!user?.id) {
        return <div>Not authenticated</div>;
    }

    const providers = await getProviders(user.id);
    const providerIds = providers.map(p => p.id);
    const scoringParameters = await getScoringParameters(providerIds);

    return <CreditScoreEngineClient initialProviders={providers} initialScoringParameters={scoringParameters} />;
}
