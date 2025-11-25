
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';

const tierSchema = z.object({
    id: z.string().optional(),
    cycleNumber: z.number().int(),
    threshold: z.number().int(),
    payoutPercentage: z.number().min(0).max(100),
});

const loanCycleConfigSchema = z.object({
    id: z.string().optional(),
    providerId: z.string(),
    cycleMetric: z.string(),
    tiers: z.array(tierSchema),
});


export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, providerId, cycleMetric, tiers } = loanCycleConfigSchema.parse(body);

        const savedConfig = await prisma.loanCycleConfig.upsert({
            where: { id: id || '' }, // Use an empty string if id is not present to force a create
            update: {
                cycleMetric,
                tiers: {
                    deleteMany: {},
                    create: tiers.map(tier => ({
                        cycleNumber: tier.cycleNumber,
                        threshold: tier.threshold,
                        payoutPercentage: tier.payoutPercentage / 100, // Store as a decimal
                    })),
                },
            },
            create: {
                providerId,
                cycleMetric,
                tiers: {
                    create: tiers.map(tier => ({
                        cycleNumber: tier.cycleNumber,
                        threshold: tier.threshold,
                        payoutPercentage: tier.payoutPercentage / 100, // Store as a decimal
                    })),
                },
            },
            include: { tiers: { orderBy: { cycleNumber: 'asc' } } }
        });

        // Convert percentage back for the client
        const responseData = {
            ...savedConfig,
            tiers: savedConfig.tiers.map(t => ({...t, payoutPercentage: t.payoutPercentage * 100 }))
        };

        return NextResponse.json(responseData, { status: 200 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error saving loan cycle config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
