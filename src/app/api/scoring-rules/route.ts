
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ScoringParameter, Rule } from '@/lib/types';
import { getUserFromSession } from '@/lib/user';

export async function POST(req: Request) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Loan Manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { providerId, parameters } = await req.json() as { providerId: string; parameters: ScoringParameter[] };

        if (!providerId || !parameters) {
            return NextResponse.json({ error: 'Missing providerId or parameters' }, { status: 400 });
        }
        
        // Use a transaction to ensure all-or-nothing update
        const transactionResults = await prisma.$transaction(async (tx) => {
            // 1. Find existing parameters for this provider
            const existingParams = await tx.scoringParameter.findMany({
                where: { providerId },
                select: { id: true },
            });
            const existingParamIds = new Set(existingParams.map(p => p.id));
            const incomingParamIds = new Set(parameters.map(p => p.id).filter(id => !id.startsWith('param-')));

            // 2. Determine which parameters to delete
            const paramsToDelete = Array.from(existingParamIds).filter(id => !incomingParamIds.has(id));
            if (paramsToDelete.length > 0) {
                await tx.scoringParameter.deleteMany({
                    where: { id: { in: paramsToDelete } },
                });
            }

            const results = [];
            // 3. Upsert parameters and their rules
            for (const param of parameters) {
                const { rules, ...paramData } = param;
                const isNewParam = param.id.startsWith('param-');
                
                const upsertedParam = await tx.scoringParameter.upsert({
                    where: { id: isNewParam ? `_new_${param.id}` : param.id }, // Use a dummy where for creation
                    update: {
                        name: paramData.name,
                        weight: paramData.weight,
                    },
                    create: {
                        providerId: providerId,
                        name: paramData.name,
                        weight: paramData.weight,
                    },
                    include: { rules: true },
                });

                // Now handle rules for this parameter
                const existingRuleIds = new Set(upsertedParam.rules.map(r => r.id));
                const incomingRuleIds = new Set(rules.map(r => r.id).filter(id => !id.startsWith('rule-')));
                
                const rulesToDelete = Array.from(existingRuleIds).filter(id => !incomingRuleIds.has(id));
                 if (rulesToDelete.length > 0) {
                    await tx.scoringParameterRule.deleteMany({
                        where: { id: { in: rulesToDelete } },
                    });
                }

                for (const rule of rules) {
                    const isNewRule = rule.id.startsWith('rule-');
                    const valueToSave = rule.condition === 'between' ? rule.value : String(parseFloat(rule.value));

                    await tx.scoringParameterRule.upsert({
                        where: { id: isNewRule ? `_new_${rule.id}` : rule.id },
                        update: {
                            field: rule.field,
                            condition: rule.condition,
                            value: valueToSave,
                            score: rule.score,
                        },
                        create: {
                            parameterId: upsertedParam.id,
                            field: rule.field,
                            condition: rule.condition,
                            value: valueToSave,
                            score: rule.score,
                        },
                    });
                }
                results.push(upsertedParam.id);
            }
             // Fetch the final state of all parameters for the provider
            const finalParams = await tx.scoringParameter.findMany({
                where: { providerId: providerId },
                include: { rules: true },
            });
            return finalParams;
        });

        return NextResponse.json(transactionResults, { status: 200 });

    } catch (error) {
        console.error('Error saving scoring parameters:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
