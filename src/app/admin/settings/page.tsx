

import { SettingsClient } from '@/components/admin/settings-client';
import type { LoanProvider as LoanProviderType, Tax } from '@/lib/types';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';

async function getProviders(userId: string): Promise<LoanProviderType[]> {
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
                include: {
                    loanAmountTiers: true,
                    eligibilityUpload: true,
                },
                orderBy: { name: 'asc' }
            },
            dataProvisioningConfigs: {
                include: {
                    uploads: {
                        orderBy: { uploadedAt: 'desc' }
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
        products: p.products.map(prod => ({
            ...prod,
            serviceFee: safeJsonParse(prod.serviceFee, { type: 'percentage', value: 0 }),
            dailyFee: safeJsonParse(prod.dailyFee, { type: 'percentage', value: 0 }),
            penaltyRules: safeJsonParse(prod.penaltyRules, []),
        }))
    })) as LoanProviderType[];
}

async function getTaxConfig(): Promise<Tax> {
    let config = await prisma.tax.findFirst();
    if (!config) {
        // Provide a default structure if no tax config is found
        config = { id: 'default', name: 'Default Tax', rate: 0, appliedTo: '[]', status: 'ACTIVE' };
    }
    return {
        ...config,
        appliedTo: config.appliedTo || '[]',
        name: config.name || 'Default'
    } as Tax;
}


export default async function AdminSettingsPage() {
    const user = await getUserFromSession();
    if (!user) {
        return <div>Not authenticated</div>;
    }
    const providers = await getProviders(user.id);
    const taxConfig = await getTaxConfig();

    return <SettingsClient initialProviders={providers} initialTaxConfig={taxConfig} />;
}
