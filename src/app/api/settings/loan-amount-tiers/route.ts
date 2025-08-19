
import { NextResponse } from 'next/server';
import { getConnectedDataSource } from '@/data-source';
import { LoanAmountTier } from '@/entities/LoanAmountTier';
import { getUserFromSession } from '@/lib/user';
import { z } from 'zod';
import { In } from 'typeorm';

const tierSchema = z.object({
  id: z.string().optional(),
  fromScore: z.number(),
  toScore: z.number(),
  loanAmount: z.number(),
});

const requestSchema = z.object({
  providerId: z.string(),
  tiers: z.array(tierSchema),
});

export async function POST(req: Request) {
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Loan Manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const body = await req.json();
        const validation = requestSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }

        const { providerId, tiers } = validation.data;
        const numericProviderId = Number(providerId);

        const dataSource = await getConnectedDataSource();
        const manager = dataSource.manager;

        await manager.transaction(async (transactionalEntityManager) => {
            const tierRepo = transactionalEntityManager.getRepository(LoanAmountTier);
            
            // Delete existing tiers for this provider
            await tierRepo.delete({ providerId: numericProviderId });

            if (tiers.length === 0) {
                return; // Just deleted everything
            }

            // Create new tiers
            const newTiers = tiers.map(tier => {
                return tierRepo.create({
                    providerId: numericProviderId,
                    fromScore: tier.fromScore,
                    toScore: tier.toScore,
                    loanAmount: tier.loanAmount,
                });
            });

            await tierRepo.save(newTiers);
        });

        // Fetch and return the newly saved tiers
        const savedTiers = await manager.getRepository(LoanAmountTier).find({
            where: { providerId: numericProviderId },
            order: { fromScore: 'ASC' },
        });

        return NextResponse.json(savedTiers, { status: 200 });

    } catch (error) {
        console.error('Error saving loan amount tiers:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
