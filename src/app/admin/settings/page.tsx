
import { SettingsClient } from '@/components/admin/settings-client';
import { AppDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import type { LoanProvider as LoanProviderType } from '@/lib/types';
import { Building2, Landmark, Briefcase, Home, PersonStanding } from 'lucide-react';

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

    // Map the icon string to a name that can be looked up on the client
    const providersWithIconNames = providers.map(p => ({
        ...p,
        id: String(p.id),
        icon: iconNameMap[p.icon] || 'Building2',
        products: p.products.map(prod => ({
            ...prod,
            id: String(prod.id),
            icon: iconNameMap[prod.icon] || 'PersonStanding'
        }))
    }));

    return providersWithIconNames as LoanProviderType[];
}


export default async function AdminSettingsPage() {
    const providers = await getProviders();

    return <SettingsClient initialProviders={providers} />;
}
