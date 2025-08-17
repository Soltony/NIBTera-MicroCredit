
import { NextResponse } from 'next/server';
import { getConnectedDataSource } from '@/data-source';
import type { LoanDetails } from '@/entities/LoanDetails';
import { getUserFromSession } from '@/lib/user';
import type { FindOptionsWhere } from 'typeorm';

export async function GET() {
    try {
        const currentUser = await getUserFromSession();
        const dataSource = await getConnectedDataSource();
        const loanRepo = dataSource.getRepository('LoanDetails');

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
    }
}
