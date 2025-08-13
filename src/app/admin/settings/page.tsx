
import { SettingsClient } from '@/components/admin/settings-client';
import { AppDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import type { LoanProvider as LoanProviderType } from '@/lib/types';

// A helper to map string names to actual icon component names for the client
const iconNameMap: { [key: string]: string } = {
  Building2: 'Building2',
  Landmark: 'Landmark',
  Briefcase: 'Briefcase',
  Home: 'Home',
  PersonStanding: 'PersonStanding',
};


async function getProviders(): Promise<LoanProviderType[]> {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    const providerRepo = AppDataSource.getRepository(LoanProvider);
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
            name: prod.name,
            description: prod.description,
            icon: iconNameMap[prod.icon] || 'PersonStanding',
            minLoan: prod.minLoan,
            maxLoan: prod.maxLoan,
            serviceFee: prod.serviceFee,
            dailyFee: prod.dailyFee,
            penaltyFee: prod.penaltyFee,
            status: prod.status as 'Active' | 'Disabled',
        }))
    })) as LoanProviderType[];
}


export default async function AdminSettingsPage() {
    const providers = await getProviders();

    return <SettingsClient initialProviders={providers} />;
}
