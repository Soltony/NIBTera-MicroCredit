

import { SettingsClient } from '@/components/admin/settings-client';
import { AppDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import { ScoringParameter } from '@/entities/ScoringParameter';
import type { LoanProvider as LoanProviderType, FeeRule, PenaltyRule, ScoringParameter as ScoringParameterType } from '@/lib/types';
import type { DataSource } from 'typeorm';

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

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

async function getProviders(): Promise<LoanProviderType[]> {
    try {
        const dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository(LoanProvider);
        const providers = await providerRepo.find({
            relations: ['products'],
            order: {
                displayOrder: 'ASC',
                products: {
                    name: 'ASC'
                }
            }
        });

        // Map to plain objects for serialization
        return providers.map(p => ({
            id: String(p.id),
            name: p.name,
            icon: iconNameMap[p.icon] || 'Building2',
            colorHex: p.colorHex,
            displayOrder: p.displayOrder,
            products: p.products.map(prod => ({
                id: String(prod.id),
                providerId: String(p.id),
                name: prod.name,
                description: prod.description,
                icon: iconNameMap[prod.icon] || 'PersonStanding',
                minLoan: prod.minLoan ?? 0,
                maxLoan: prod.maxLoan ?? 0,
                serviceFee: safeJsonParse(prod.serviceFee, { type: 'percentage', value: 0 }),
                dailyFee: safeJsonParse(prod.dailyFee, { type: 'percentage', value: 0 }),
                penaltyRules: safeJsonParse(prod.penaltyRules, []),
                status: prod.status as 'Active' | 'Disabled',
                serviceFeeEnabled: !!prod.serviceFeeEnabled,
                dailyFeeEnabled: !!prod.dailyFeeEnabled,
                penaltyRulesEnabled: !!prod.penaltyRulesEnabled,
            }))
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
