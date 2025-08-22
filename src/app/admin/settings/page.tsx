
import { SettingsClient } from '@/components/admin/settings-client';
import type { LoanProvider as LoanProviderType } from '@/lib/types';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';

async function getProviders(userId: string): Promise<LoanProviderType[]> {
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
            products: {
                include: {
                    loanAmountTiers: true,
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


export default async function AdminSettingsPage() {
    const user = await getUserFromSession();
    if (!user) {
        return <div>Not authenticated</div>;
    }
    const providers = await getProviders(user.id);

    return <SettingsClient initialProviders={providers} />;
}
