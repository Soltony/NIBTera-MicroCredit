
import { NextResponse } from 'next/server';
import { AppDataSource } from '@/data-source';
import { ScoringParameter } from '@/entities/ScoringParameter';
import { ScoringParameterRule } from '@/entities/ScoringParameterRule';
import type { ScoringParameter as ScoringParameterType, Rule } from '@/lib/types';
import { getUserFromSession } from '@/lib/user';
import { In } from 'typeorm';


export async function POST(req: Request) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Loan Manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!AppDataSource.isInitialized) await AppDataSource.initialize();
        const manager = AppDataSource.manager;

        const { providerId, parameters } = await req.json() as { providerId: string; parameters: ScoringParameterType[] };

        if (!providerId || !parameters) {
            return NextResponse.json({ error: 'Missing providerId or parameters' }, { status: 400 });
        }
        
        await manager.transaction(async (transactionalEntityManager) => {
            const paramRepo = transactionalEntityManager.getRepository(ScoringParameter);
            const ruleRepo = transactionalEntityManager.getRepository(ScoringParameterRule);

            const existingParams = await paramRepo.find({ where: { providerId: Number(providerId) } });
            const incomingParamIds = new Set(parameters.map(p => p.id).filter(id => !id.startsWith('param-')));
            const paramsToDelete = existingParams.filter(p => !incomingParamIds.has(String(p.id)));

            if (paramsToDelete.length > 0) {
                await paramRepo.remove(paramsToDelete);
            }

            for (const param of parameters) {
                const isNewParam = param.id.startsWith('param-');
                
                let savedParam: ScoringParameter;
                if (isNewParam) {
                    savedParam = await paramRepo.save({
                        providerId: Number(providerId),
                        name: param.name,
                        weight: param.weight
                    });
                } else {
                    await paramRepo.update(param.id, { name: param.name, weight: param.weight });
                    savedParam = (await paramRepo.findOneBy({ id: Number(param.id) }))!;
                }

                const existingRules = await ruleRepo.find({ where: { parameterId: savedParam.id } });
                const incomingRuleIds = new Set(param.rules.map(r => r.id).filter(id => !id.startsWith('rule-')));
                const rulesToDelete = existingRules.filter(r => !incomingRuleIds.has(String(r.id)));

                if (rulesToDelete.length > 0) {
                    await ruleRepo.remove(rulesToDelete);
                }

                for (const rule of param.rules) {
                    const isNewRule = rule.id.startsWith('rule-');
                    const valueToSave = rule.condition === 'between' ? rule.value : String(parseFloat(rule.value));

                     if (isNewRule) {
                        await ruleRepo.save({
                            parameterId: savedParam.id,
                            field: rule.field,
                            condition: rule.condition,
                            value: valueToSave,
                            score: rule.score,
                        });
                    } else {
                         await ruleRepo.update(rule.id, {
                            field: rule.field,
                            condition: rule.condition,
                            value: valueToSave,
                            score: rule.score,
                        });
                    }
                }
            }
        });

        const finalParams = await manager.getRepository(ScoringParameter).find({
            where: { providerId: Number(providerId) },
            relations: ['rules'],
        });

        return NextResponse.json(finalParams, { status: 200 });

    } catch (error) {
        console.error('Error saving scoring parameters:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
