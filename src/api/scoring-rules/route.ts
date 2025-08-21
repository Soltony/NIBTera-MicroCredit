
import { NextResponse } from 'next/server';
import { getConnectedDataSource } from '@/data-source';
import { ScoringParameter } from '@/entities/ScoringParameter';
import { ScoringParameterRule } from '@/entities/ScoringParameterRule';
import type { ScoringParameter as ScoringParameterType, Rule } from '@/lib/types';
import { getUserFromSession } from '@/lib/user';
import { In, DataSource } from 'typeorm';

export async function POST(req: Request) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Loan Manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dataSource = await getConnectedDataSource();
        const manager = dataSource.manager;

        const { providerId, parameters, rules } = await req.json() as { providerId: string; parameters: ScoringParameterType[], rules: Rule[] };

        if (!providerId || !parameters || !rules) {
            return NextResponse.json({ error: 'Missing providerId, parameters, or rules' }, { status: 400 });
        }
        
        await manager.transaction(async (transactionalEntityManager) => {
            const paramRepo = transactionalEntityManager.getRepository(ScoringParameter);
            const ruleRepo = transactionalEntityManager.getRepository(ScoringParameterRule);

            // Sync Parameters
            const existingParams = await paramRepo.find({ where: { providerId: Number(providerId) } });
            const incomingParamIds = new Set(parameters.map(p => p.id).filter(id => !String(id).startsWith('param-')));
            const paramsToDelete = existingParams.filter(p => !incomingParamIds.has(String(p.id)));
            if (paramsToDelete.length > 0) await paramRepo.remove(paramsToDelete);

            for (const param of parameters) {
                const isNewParam = String(param.id).startsWith('param-');
                const paramData = {
                    providerId: Number(providerId),
                    name: param.name,
                    weight: param.weight,
                };
                if (isNewParam) {
                    await paramRepo.save(paramData);
                } else {
                    await paramRepo.update(param.id, paramData);
                }
            }

            // Sync Rules
            const existingRules = await ruleRepo.find({ where: { providerId: Number(providerId) } });
            const incomingRuleIds = new Set(rules.map(r => r.id).filter(id => !String(id).startsWith('rule-')));
            const rulesToDelete = existingRules.filter(r => !incomingRuleIds.has(String(r.id)));
            if (rulesToDelete.length > 0) await ruleRepo.remove(rulesToDelete);

            for (const rule of rules) {
                const isNewRule = String(rule.id).startsWith('rule-');
                const ruleData = {
                    providerId: Number(providerId),
                    field: rule.field,
                    condition: rule.condition,
                    value: String(rule.value),
                    score: rule.score,
                };

                 if (isNewRule) {
                    await ruleRepo.save(ruleData);
                } else {
                     await ruleRepo.update(rule.id, ruleData);
                }
            }
        });

        const finalParams = await manager.getRepository(ScoringParameter).find({ where: { providerId: Number(providerId) } });
        const finalRules = await manager.getRepository(ScoringParameterRule).find({ where: { providerId: Number(providerId) } });

        return NextResponse.json({ savedParameters: finalParams, savedRules: finalRules }, { status: 200 });

    } catch (error) {
        console.error('Error saving scoring configuration:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
