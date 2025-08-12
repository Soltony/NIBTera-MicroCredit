
import { SettingsClient } from '@/components/admin/settings-client';
import { prisma } from '@/lib/prisma';
import type { LoanProvider } from '@/lib/types';
import { Building2, Landmark, Briefcase, Home, PersonStanding } from 'lucide-react';

// A helper to map string names to actual icon component names for the client
const iconNameMap: { [key: string]: string } = {
  Building2: 'Building2',
  Landmark: 'Landmark',
  Briefcase: 'Briefcase',
  Home: 'Home',
  PersonStanding: 'PersonStanding',
};


async function getProviders(): Promise<LoanProvider[]> {
    const providers = await prisma.loanProvider.findMany({
        include: {
            products: {
                orderBy: {
                    name: 'asc'
                }
            },
        },
        orderBy: {
            name: 'asc'
        }
    });

    // Map the icon string to a name that can be looked up on the client
    const providersWithIconNames = providers.map(p => ({
        ...p,
        icon: iconNameMap[p.icon] || 'Building2',
        products: p.products.map(prod => ({
            ...prod,
            icon: iconNameMap[prod.icon] || 'PersonStanding'
        }))
    }));

    return providersWithIconNames;
}


export default async function AdminSettingsPage() {
    const providers = await getProviders();

    return <SettingsClient initialProviders={providers} />;
}
