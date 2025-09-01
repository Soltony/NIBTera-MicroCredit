
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const { providerId, parameters } = await req.json();
        if (!providerId || !parameters) {
            return NextResponse.json({ error: 'providerId and parameters are required' }, { status: 400 });
        }

        // Use a transaction to delete old rules and create new ones
        const transaction = await prisma.$transaction(async (tx) => {
            // Delete all existing rules for this provider
            await tx.scoringParameter.deleteMany({ where: { providerId } });

            // Create new parameters and their rules
            const createdParameters = [];
            for (const param of parameters) {
                const newParam = await tx.scoringParameter.create({
                    data: {
                        providerId: providerId,
                        name: param.name,
                        weight: param.weight,
                        rules: {
                            create: param.rules.map((rule: any) => ({
                                field: rule.field,
                                condition: rule.condition,
                                value: String(rule.value),
                                score: rule.score,
                            })),
                        },
                    },
                    include: {
                        rules: true,
                    },
                });
                createdParameters.push(newParam);
            }
            return createdParameters;
        });

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            action: 'SCORING_RULES_UPDATE_SUCCESS',
            actorId: session.userId,
            details: {
                providerId: providerId,
                parameterCount: parameters.length,
            }
        }));

        return NextResponse.json(transaction, { status: 201 });
    } catch (error) {
        console.error('Error saving scoring rules:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
