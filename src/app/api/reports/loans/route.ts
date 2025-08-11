
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
    try {
        const currentUser = await getCurrentUser();

        const whereClause: any = {};
        if (currentUser?.role === 'Loan Provider' && currentUser.providerId) {
            whereClause.providerId = currentUser.providerId;
        }

        const loans = await prisma.loanDetails.findMany({
            where: whereClause,
            include: {
                provider: true,
                product: true,
                payments: true,
            },
            orderBy: {
                disbursedDate: 'desc',
            },
        });

        const loansToReturn = loans.map(loan => ({
            ...loan,
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
