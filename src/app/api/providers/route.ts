
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Building2, Landmark, Briefcase, Home, PersonStanding } from 'lucide-react';
import type { LoanProvider } from '@/lib/types';

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
        const providers = await prisma.loanProvider.findMany({
            include: {
                products: {
                    orderBy: {
                        name: 'asc'
                    }
                },
            },
            orderBy: {
                displayOrder: 'asc'
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

        return NextResponse.json(providersWithIconNames);
    } catch (error) {
        console.error('Error fetching providers:', error);
        return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
    }
}
