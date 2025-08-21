
import { SettingsClient } from '@/components/admin/settings-client';
import { getConnectedDataSource } from '@/data-source';
import type { LoanProvider as LoanProviderType, DataProvisioningConfig } from '@/lib/types';

// A helper to map string names to actual icon component names for the client
const iconNameMap: { [key: string]: string } = {
  Building2: 'Building2',
  Landmark: 'Landmark',
  Briefcase: 'Briefcase',
  Home: 'Home',
  PersonStanding: 'PersonStanding',
};

// Helper function to safely parse JSON from DB
const safeJsonParse = (jsonString: string | null | undefined, defaultValue: any) => {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return defaultValue;
    }
};

async function getProviders(): Promise<LoanProviderType[]> {
    try {
        const dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository('LoanProvider');
        const providers = await providerRepo.find({
            relations: ['products', 'products.loanAmountTiers', 'dataProvisioningConfigs', 'dataProvisioningConfigs.uploads', 'dataProvisioningConfigs.uploads.uploadedByUser'],
            order: {
                displayOrder: 'ASC',
                products: {
                    name: 'ASC'
                },
            }
        });

        // Map to plain objects for serialization
        return providers.map(p => ({
            id: String(p.id),
            name: p.name,
            icon: iconNameMap[p.icon] || 'Building2',
            colorHex: p.colorHex,
            displayOrder: p.displayOrder,
            accountNumber: p.accountNumber,
            allowMultipleProviderLoans: p.allowMultipleProviderLoans,
            allowCrossProviderLoans: p.allowCrossProviderLoans,
            products: p.products.map(prod => ({
                id: String(prod.id),
                providerId: String(p.id),
                name: prod.name,
                description: prod.description,
                icon: iconNameMap[prod.icon] || 'PersonStanding',
                minLoan: prod.minLoan ?? 0,
                maxLoan: prod.maxLoan ?? 0,
                serviceFee: safeJsonParse(prod.serviceFee, { type: 'percentage', value: 0 }),
                dailyFee: safeJsonParse(prod.dailyFee, { type: 'percentage', value: 0, calculationBase: 'principal' }),
                penaltyRules: safeJsonParse(prod.penaltyRules, []).map((rule: any) => ({ ...rule, toDay: rule.toDay === Infinity ? null : rule.toDay })),
                loanAmountTiers: prod.loanAmountTiers ? prod.loanAmountTiers.map(tier => ({...tier, id: String(tier.id)})).sort((a,b) => a.fromScore - b.fromScore) : [],
                status: prod.status as 'Active' | 'Disabled',
                serviceFeeEnabled: !!prod.serviceFeeEnabled,
                dailyFeeEnabled: !!prod.dailyFeeEnabled,
                penaltyRulesEnabled: !!prod.penaltyRulesEnabled,
                dataProvisioningEnabled: !!prod.dataProvisioningEnabled,
                dataProvisioningConfigId: prod.dataProvisioningConfigId ? String(prod.dataProvisioningConfigId) : null,
            })),
            dataProvisioningConfigs: p.dataProvisioningConfigs ? p.dataProvisioningConfigs.map(dpc => ({
                id: String(dpc.id),
                providerId: String(dpc.providerId),
                name: dpc.name,
                columns: safeJsonParse(dpc.columns, []),
                uploads: dpc.uploads ? dpc.uploads.map(upload => ({
                    id: String(upload.id),
                    configId: String(upload.configId),
                    fileName: upload.fileName,
                    rowCount: upload.rowCount,
                    uploadedAt: upload.uploadedAt.toISOString(),
                    uploadedBy: upload.uploadedByUser.fullName,
                })).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()) : [],
            })) : [],
        })) as LoanProviderType[];
    } catch(e) {
        console.error(e);
        return [];
    }
}


export default async function AdminSettingsPage() {
    const providers = await getProviders();

    return <SettingsClient initialProviders={providers} />;
}
