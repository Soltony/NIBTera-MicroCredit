
import { Suspense } from 'react';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import type { LoanDetails } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { LoanDetailClient } from './client';
import { calculateTotalRepayable } from '@/lib/loan-calculator';

export const dynamic = 'force-dynamic';

const safeJsonParse = (jsonString: string | null | undefined, defaultValue: any) => {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return defaultValue;
    }
};

async function getLoanDetails(loanId: string): Promise<LoanDetails | null> {
    try {
        if (!loanId) return null;

        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                product: {
                    include: {
                        provider: true
                    }
                },
                payments: {
                    orderBy: {
                        date: 'desc'
                    }
                }
            }
        });

        if (!loan) return null;
        
        const parsedProduct = {
            ...loan.product,
            serviceFee: safeJsonParse(loan.product.serviceFee, { type: 'percentage', value: 0 }),
            dailyFee: safeJsonParse(loan.product.dailyFee, { type: 'percentage', value: 0 }),
            penaltyRules: safeJsonParse(loan.product.penaltyRules, []),
        };

        // Here we perform the calculation on the server side
        const calculated = await calculateTotalRepayable(loan as any, parsedProduct, new Date());

        return {
            id: loan.id,
            borrowerId: loan.borrowerId,
            providerName: loan.product.provider.name,
            productName: loan.product.name,
            loanAmount: loan.loanAmount,
            serviceFee: loan.serviceFee,
            disbursedDate: loan.disbursedDate,
            dueDate: loan.dueDate,
            repaymentStatus: loan.repaymentStatus as 'Paid' | 'Unpaid',
            repaidAmount: loan.repaidAmount || 0,
            penaltyAmount: loan.penaltyAmount,
            product: parsedProduct,
            payments: loan.payments.map(p => ({
                id: p.id,
                amount: p.amount,
                date: p.date,
                outstandingBalanceBeforePayment: p.outstandingBalanceBeforePayment,
            })),
            // Pass the calculated values to the client
            calculatedRepayment: calculated
        } as unknown as LoanDetails;

    } catch(e) {
        console.error(e);
        return null;
    }
}


export default async function LoanDetailPage({ params }: { params: { loanId: string } }) {
    const loanId = params.loanId;
    const loanDetails = await getLoanDetails(loanId);

    if (!loanDetails) {
        notFound();
    }
    
    return (
        <Suspense fallback={
             <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h2 className="text-xl font-semibold">Loading Loan Details...</h2>
                </div>
            </div>
        }>
            <LoanDetailClient loanDetails={loanDetails} />
        </Suspense>
    );
}


    
