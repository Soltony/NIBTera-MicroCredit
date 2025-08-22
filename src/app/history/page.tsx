
import type { LoanDetails, LoanProvider } from '@/lib/types';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { HistoryClient } from '@/components/history/history-client';
import prisma from '@/lib/prisma';

async function getProviders(): Promise<LoanProvider[]> {
    const providers = await prisma.loanProvider.findMany({
        orderBy: { displayOrder: 'asc' }
    });
    return providers as LoanProvider[];
}


async function getLoanHistory(): Promise<LoanDetails[]> {
    try {
        const loans = await prisma.loan.findMany({
            include: {
                provider: true,
                product: true,
                payments: {
                    orderBy: {
                        date: 'asc'
                    }
                }
            },
            orderBy: {
                disbursedDate: 'desc'
            }
        });

        return loans.map(loan => ({
            id: loan.id,
            providerId: loan.providerId,
            providerName: loan.provider.name,
            productName: loan.product.name,
            loanAmount: loan.loanAmount,
            serviceFee: loan.serviceFee,
            disbursedDate: loan.disbursedDate,
            dueDate: loan.dueDate,
            repaymentStatus: loan.repaymentStatus as 'Paid' | 'Unpaid',
            repaidAmount: loan.repaidAmount || 0,
            penaltyAmount: loan.penaltyAmount,
            product: {
              ...loan.product,
              serviceFee: JSON.parse(loan.product.serviceFee as string),
              dailyFee: JSON.parse(loan.product.dailyFee as string),
              penaltyRules: JSON.parse(loan.product.penaltyRules as string),
            },
            payments: loan.payments.map(p => ({
                id: p.id,
                amount: p.amount,
                date: p.date,
                outstandingBalanceBeforePayment: p.outstandingBalanceBeforePayment,
            }))
        })) as LoanDetails[];
    } catch(e) {
        console.error(e);
        return [];
    }
}


export default async function HistoryPage() {
    const loanHistory = await getLoanHistory();
    const providers = await getProviders();
    
    return (
        <Suspense fallback={
            <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <HistoryClient initialLoanHistory={loanHistory} providers={providers} />
        </Suspense>
    );
}
