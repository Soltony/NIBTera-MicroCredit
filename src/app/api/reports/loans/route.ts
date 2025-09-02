
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInDays } from 'date-fns';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import type { Loan, LoanProduct, Payment } from '@prisma/client';

const getDates = (timeframe: string) => {
    const now = new Date();
    switch (timeframe) {
        case 'daily':
            return { gte: startOfDay(now), lte: endOfDay(now) };
        case 'weekly':
            return { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) };
        case 'monthly':
            return { gte: startOfMonth(now), lte: endOfMonth(now) };
        case 'yearly':
            return { gte: startOfYear(now), lte: endOfYear(now) };
        case 'overall':
        default:
            return { gte: undefined, lte: undefined };
    }
};

type LoanWithRelations = Loan & {
    product: LoanProduct & { provider: { name: string } };
    payments: Payment[];
    borrower: { id: string, fullName: string | null };
};

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');
    const timeframe = searchParams.get('timeframe') || 'overall';
    const dateRange = getDates(timeframe);

    const whereClause: any = {
        ...(providerId && providerId !== 'all' && { product: { providerId } }),
        ...(dateRange.gte && { disbursedDate: { gte: dateRange.gte } }),
        ...(dateRange.lte && { disbursedDate: { lte: dateRange.lte } }),
    };

    try {
        const loans = await prisma.loan.findMany({
            where: whereClause,
            include: {
                product: {
                    include: {
                        provider: true,
                    },
                },
                payments: true,
                borrower: {
                    select: {
                        id: true,
                        fullName: true,
                    }
                }
            },
            orderBy: {
                disbursedDate: 'desc',
            },
        });
        
        const today = new Date();
        const reportData = loans.map(loan => {
            const { total, principal, interest, penalty, serviceFee } = calculateTotalRepayable(loan as any, loan.product, today);
            
            const totalRepaid = (loan.repaidAmount || 0);

            const principalOutstanding = Math.max(0, principal - totalRepaid);
            const interestOutstanding = Math.max(0, interest - Math.max(0, totalRepaid - principal));
            const serviceFeeOutstanding = Math.max(0, serviceFee - Math.max(0, totalRepaid - principal - interest));
            const penaltyOutstanding = Math.max(0, penalty - Math.max(0, totalRepaid - principal - interest - serviceFee));
            const totalOutstanding = Math.max(0, total - totalRepaid);

            let status = 'Current';
            const daysInArrears = differenceInDays(today, loan.dueDate);
            if (loan.repaymentStatus === 'Unpaid' && daysInArrears > 0) {
                status = 'Overdue';
                if (daysIn2ars > 60) { // Example for NPL/Defaulted
                    status = 'Defaulted';
                }
            } else if (loan.repaymentStatus === 'Paid') {
                status = 'Paid';
            }
            
            return {
                provider: loan.product.provider.name,
                loanId: loan.id,
                borrowerId: loan.borrowerId,
                borrowerName: loan.borrower?.fullName || `B-${loan.borrowerId.slice(0, 4)}`,
                principalDisbursed: loan.loanAmount,
                principalOutstanding,
                interestOutstanding,
                serviceFeeOutstanding,
                penaltyOutstanding,
                totalOutstanding,
                status,
                daysInArrears: status === 'Overdue' ? daysInArrears : 0,
            };
        });

        return NextResponse.json(reportData);

    } catch (error) {
        console.error('Failed to fetch loans report:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
