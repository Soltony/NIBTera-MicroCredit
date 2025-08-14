
import { NextResponse } from 'next/server';
import { AppDataSource } from '@/data-source';
import { LoanDetails } from '@/entities/LoanDetails';
import { getUserFromSession } from '@/lib/user';
import type { FindOptionsWhere, DataSource } from 'typeorm';

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

export async function GET() {
    let dataSource: DataSource | null = null;
    try {
        const currentUser = await getUserFromSession();
        dataSource = await getConnectedDataSource();
        const loanRepo = dataSource.getRepository(LoanDetails);

        const whereClause: FindOptionsWhere<LoanDetails> = {};
        if (currentUser?.role === 'Loan Provider' && currentUser.providerId) {
            whereClause.providerId = Number(currentUser.providerId);
        }

        const loans = await loanRepo.find({
            where: whereClause,
            relations: ['provider', 'product', 'payments'],
            order: {
                disbursedDate: 'DESC',
            },
        });

        const loansToReturn = loans.map(loan => ({
            ...loan,
            id: String(loan.id),
            providerName: loan.provider.name,
            productName: loan.product.name,
            paymentsCount: loan.payments.length,
        }));
        
        return NextResponse.json(loansToReturn);

    } catch (error) {
        console.error('Error fetching loan reports:', error);
        return NextResponse.json({ error: 'Failed to fetch loan reports' }, { status: 500 });
    } finally {
        if (dataSource && AppDataSource.options.type !== 'oracle') {
           // await dataSource.destroy();
        }
    }
}
