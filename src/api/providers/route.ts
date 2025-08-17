
import { NextResponse } from 'next/server';
import { getConnectedDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import { Building2, Landmark, Briefcase, Home, PersonStanding } from 'lucide-react';
import type { DataSource } from 'typeorm';

// A helper to map string names to actual icon component names for the client
const iconNameMap: { [key: string]: string } = {
  Building2: 'Building2',
  Landmark: 'Landmark',
  Briefcase: 'Briefcase',
  Home: 'Home',
  PersonStanding: 'PersonStanding',
};

// GET all providers
export async function GET() {
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

        return NextResponse.json(providersWithIconNames);
    } catch (error) {
        console.error('Error fetching providers:', error);
        return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
    }
}
