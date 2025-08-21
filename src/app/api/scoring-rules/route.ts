
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

        const { providerId, parameters } = await req.json() as { providerId: string; parameters: ScoringParameterType[] };

        if (!providerId || !parameters) {
            return NextResponse.json({ error: 'Missing providerId or parameters' }, { status: 400 });
        }
        
        await manager.transaction(async (transactionalEntityManager) => {
            const paramRepo = transactionalEntityManager.getRepository(ScoringParameter);
            const ruleRepo = transactionalEntityManager.getRepository(ScoringParameterRule);

            const existingParams = await paramRepo.find({ where: { providerId: Number(providerId) } });
            const incomingParamIds = new Set(parameters.map(p => p.id).filter(id => !String(id).startsWith('param-')));
            const paramsToDelete = existingParams.filter(p => !incomingParamIds.has(String(p.id)));

            if (paramsToDelete.length > 0) {
                // TypeORM will cascade delete the rules associated with these parameters
                await paramRepo.remove(paramsToDelete);
            }

            for (const param of parameters) {
                const isNewParam = String(param.id).startsWith('param-');
                
                const paramEntity = new ScoringParameter();
                paramEntity.providerId = Number(providerId);
                paramEntity.name = param.name;
                paramEntity.weight = param.weight;

                let savedParam: ScoringParameter;
                if (isNewParam) {
                    savedParam = await paramRepo.save(paramEntity);
                } else {
                    await paramRepo.update(param.id, { name: param.name, weight: param.weight });
                    savedParam = (await paramRepo.findOneBy({ id: Number(param.id) }))!;
                }

                // Sync rules for this parameter
                const existingRules = await ruleRepo.find({ where: { parameterId: savedParam.id } });
                const incomingRuleIds = new Set((param.rules || []).map(r => r.id).filter(id => !String(id).startsWith('rule-')));
                const rulesToDelete = existingRules.filter(r => !incomingRuleIds.has(String(r.id)));

                if (rulesToDelete.length > 0) {
                    await ruleRepo.remove(rulesToDelete);
                }
                
                if (param.rules) {
                    for (const rule of param.rules) {
                        const isNewRule = String(rule.id).startsWith('rule-');
                        const valueToSave = rule.value;

                        const ruleEntity = new ScoringParameterRule();
                        ruleEntity.parameterId = savedParam.id;
                        ruleEntity.field = rule.field;
                        ruleEntity.condition = rule.condition;
                        ruleEntity.value = valueToSave;
                        ruleEntity.score = rule.score;

                        if (isNewRule) {
                            await ruleRepo.save(ruleEntity);
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
            }
        });

        const finalParams = await manager.getRepository(ScoringParameter).find({
            where: { providerId: Number(providerId) },
            relations: ['rules'], // Eager loading might already do this, but being explicit is safer
        });

        return NextResponse.json(finalParams, { status: 200 });

    } catch (error) {
        console.error('Error saving scoring parameters:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
