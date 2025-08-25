
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');

    if (!providerId) {
        return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }

    try {
        const history = await prisma.scoringConfigurationHistory.findMany({
            where: { providerId },
            orderBy: { savedAt: 'desc' },
            include: {
                appliedProducts: {
                    select: {
                        product: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });
        return NextResponse.json(history);
    } catch (error) {
        console.error('Error fetching scoring history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    try {
        const body = await req.json();
        const { providerId, parameters, appliedProductIds } = body;
        
        const newHistory = await prisma.scoringConfigurationHistory.create({
            data: {
                providerId,
                parameters: JSON.stringify(parameters),
                appliedProducts: {
                    create: appliedProductIds.map((id: string) => ({
                        product: { connect: { id } },
                        assignedBy: session.userId, // This assumes user id is a string
                    }))
                }
            },
            include: {
                appliedProducts: {
                    select: {
                        product: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            }
        });
        
        return NextResponse.json(newHistory, { status: 201 });
    } catch (error) {
        console.error('Error creating scoring history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
