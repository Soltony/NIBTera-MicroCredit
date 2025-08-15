
import { NextResponse } from 'next/server';
import { AppDataSource } from '@/data-source';
import { ScoringParameter } from '@/entities/ScoringParameter';
import { ScoringParameterRule } from '@/entities/ScoringParameterRule';
import type { ScoringParameter as ScoringParameterType, Rule } from '@/lib/types';
import { getUserFromSession } from '@/lib/user';
import { In, DataSource } from 'typeorm';

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

export async function POST(req: Request) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Loan Manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dataSource = await getConnectedDataSource();
        const manager = dataSource.manager;

        const { providerId, parameters } = await req.json() as { providerId: string; parameters: ScoringParameterType[] };
        const numericProviderId = Number(providerId);

        if (!providerId || !parameters) {
            return NextResponse.json({ error: 'Missing providerId or parameters' }, { status: 400 });
        }
        
        await manager.transaction(async (transactionalEntityManager) => {
            const paramRepo = transactionalEntityManager.getRepository(ScoringParameter);
            const ruleRepo = transactionalEntityManager.getRepository(ScoringParameterRule);

            // 1. Delete all existing parameters for this provider.
            // The cascade option on the entity will also delete the associated rules.
            await paramRepo.delete({ providerId: numericProviderId });

            // 2. Insert the new configuration from scratch.
            for (const param of parameters) {
                // Create and save the new parameter
                const newParam = paramRepo.create({
                    providerId: numericProviderId,
                    name: param.name,
                    weight: param.weight,
                });
                const savedParam = await paramRepo.save(newParam);
                
                if (param.rules && param.rules.length > 0) {
                    // Create rule entities linked to the newly saved parameter
                    const rulesToCreate = param.rules.map(rule => ruleRepo.create({
                        parameterId: savedParam.id,
                        field: rule.field,
                        condition: rule.condition,
                        value: rule.condition === 'between' ? rule.value : String(parseFloat(rule.value)),
                        score: rule.score,
                    }));
                    // Save all rules for this parameter
                    await ruleRepo.save(rulesToCreate);
                }
            }
        });

        // After the transaction, fetch the final state to return to the client.
        const finalParams = await manager.getRepository(ScoringParameter).find({
            where: { providerId: numericProviderId },
            relations: ['rules'],
        });

        return NextResponse.json(finalParams, { status: 200 });

    } catch (error: any) {
        console.error('Error saving scoring parameters:', error);
        return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
    }
}
