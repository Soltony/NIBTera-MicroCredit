
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';

// GET history for a provider
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const providerId = searchParams.get('providerId');

        if (!providerId) {
            return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
        }

        const history = await prisma.scoringConfigurationHistory.findMany({
            where: { providerId },
            take: 5,
            orderBy: {
                savedAt: 'desc',
            },
            include: {
                appliedProducts: {
                    select: { name: true },
                },
            },
        });
        
        const results = history.map(h => ({
            ...h,
            parameters: JSON.parse(h.parameters as string)
        }))

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error fetching scoring history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


// POST a new history entry
export async function POST(req: Request) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Loan Manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { providerId, parameters, appliedProductIds } = await req.json();

        if (!providerId || !parameters || !appliedProductIds) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const newHistoryEntry = await prisma.scoringConfigurationHistory.create({
            data: {
                providerId,
                parameters: JSON.stringify(parameters),
                appliedProducts: {
                    connect: appliedProductIds.map((id: string) => ({ id })),
                },
            },
             include: {
                appliedProducts: {
                    select: { name: true },
                },
            },
        });
        
        const result = {
            ...newHistoryEntry,
            parameters: JSON.parse(newHistoryEntry.parameters as string)
        };

        return NextResponse.json(result, { status: 201 });

    } catch (error) {
        console.error('Error saving scoring history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
