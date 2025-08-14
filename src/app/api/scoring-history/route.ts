
import { NextResponse } from 'next/server';
import { AppDataSource } from '@/data-source';
import { ScoringConfigurationHistory } from '@/entities/ScoringConfigurationHistory';
import { LoanProduct } from '@/entities/LoanProduct';
import { getUserFromSession } from '@/lib/user';
import { In, DataSource } from 'typeorm';

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

// GET history for a provider
export async function GET(req: Request) {
    let dataSource: DataSource | null = null;
    try {
        dataSource = await getConnectedDataSource();
        const historyRepo = dataSource.getRepository(ScoringConfigurationHistory);

        const { searchParams } = new URL(req.url);
        const providerId = searchParams.get('providerId');

        if (!providerId) {
            return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
        }

        const history = await historyRepo.find({
            where: { providerId: Number(providerId) },
            take: 5,
            order: {
                savedAt: 'DESC',
            },
            relations: ['appliedProducts'],
        });
        
        return NextResponse.json(history.map(h => ({...h, parameters: JSON.parse(h.parameters)})));
    } catch (error) {
        console.error('Error fetching scoring history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        if (dataSource && AppDataSource.options.type !== 'oracle') {
            // await dataSource.destroy();
        }
    }
}


// POST a new history entry
export async function POST(req: Request) {
    let dataSource: DataSource | null = null;
    try {
        const currentUser = await getUserFromSession();
        if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Loan Manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        dataSource = await getConnectedDataSource();
        const historyRepo = dataSource.getRepository(ScoringConfigurationHistory);
        const productRepo = dataSource.getRepository(LoanProduct);

        const { providerId, parameters, appliedProductIds } = await req.json();

        if (!providerId || !parameters || !appliedProductIds) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        const appliedProducts = await productRepo.findBy({ id: In(appliedProductIds.map(Number)) });

        const newHistoryEntry = historyRepo.create({
            providerId: Number(providerId),
            parameters: JSON.stringify(parameters),
            appliedProducts: appliedProducts,
        });

        const savedEntry = await historyRepo.save(newHistoryEntry);

        return NextResponse.json({
            ...savedEntry,
            parameters: JSON.parse(savedEntry.parameters),
            appliedProducts: savedEntry.appliedProducts.map(p => ({name: p.name}))
        }, { status: 201 });

    } catch (error) {
        console.error('Error saving scoring history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        if (dataSource && AppDataSource.options.type !== 'oracle') {
            // await dataSource.destroy();
        }
    }
}
