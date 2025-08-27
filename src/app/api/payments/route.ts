
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { calculateTotalRepayable } from '@/lib/loan-calculator';

const paymentSchema = z.object({
  loanId: z.string(),
  amount: z.number().positive(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { loanId, amount: paymentAmount } = paymentSchema.parse(body);

        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: { 
                product: {
                    include: {
                        provider: {
                            include: {
                                ledgerAccounts: true
                            }
                        }
                    }
                }
            }
        });

        if (!loan) {
            return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
        }
        
        const provider = loan.product.provider;
        
        const { total, principal, interest, penalty } = calculateTotalRepayable(loan as any, loan.product, new Date());
        const totalDue = total - (loan.repaidAmount || 0);

        if (paymentAmount > totalDue) {
             return NextResponse.json({ error: 'Payment amount exceeds balance due.' }, { status: 400 });
        }
        
        const updatedLoan = await prisma.$transaction(async (tx) => {
            let amountToApply = paymentAmount;
            
            const principalReceivable = provider.ledgerAccounts.find(a => a.category === 'Principal' && a.type === 'Receivable');
            const interestReceivable = provider.ledgerAccounts.find(a => a.category === 'Interest' && a.type === 'Receivable');
            const penaltyReceivable = provider.ledgerAccounts.find(a => a.category === 'Penalty' && a.type === 'Receivable');
            const principalReceived = provider.ledgerAccounts.find(a => a.category === 'Principal' && a.type === 'Received');
            const interestReceived = provider.ledgerAccounts.find(a => a.category === 'Interest' && a.type === 'Received');
            const penaltyReceived = provider.ledgerAccounts.find(a => a.category === 'Penalty' && a.type === 'Received');
            
            if (!principalReceivable || !interestReceivable || !penaltyReceivable || !principalReceived || !interestReceived || !penaltyReceived) {
                throw new Error(`One or more ledger accounts not found for provider ${provider.id}`);
            }

            // Apply payment according to priority: Penalty -> Interest -> Principal
            const penaltyToPay = Math.min(amountToApply, penalty);
            if (penaltyToPay > 0) {
                await tx.ledgerAccount.update({ where: { id: penaltyReceivable.id }, data: { balance: { decrement: penaltyToPay } } });
                await tx.ledgerAccount.update({ where: { id: penaltyReceived.id }, data: { balance: { increment: penaltyToPay } } });
                amountToApply -= penaltyToPay;
            }

            const interestToPay = Math.min(amountToApply, interest);
             if (interestToPay > 0) {
                await tx.ledgerAccount.update({ where: { id: interestReceivable.id }, data: { balance: { decrement: interestToPay } } });
                await tx.ledgerAccount.update({ where: { id: interestReceived.id }, data: { balance: { increment: interestToPay } } });
                amountToApply -= interestToPay;
            }
            
            const principalToPay = amountToApply; // Whatever is left
             if (principalToPay > 0) {
                await tx.ledgerAccount.update({ where: { id: principalReceivable.id }, data: { balance: { decrement: principalToPay } } });
                await tx.ledgerAccount.update({ where: { id: principalReceived.id }, data: { balance: { increment: principalToPay } } });
            }

            // Create payment record
            await tx.payment.create({
                data: {
                    loanId,
                    amount: paymentAmount,
                    date: new Date(),
                    outstandingBalanceBeforePayment: totalDue,
                }
            });

            const newRepaidAmount = (loan.repaidAmount || 0) + paymentAmount;
            
            // Update loan status
            const finalLoan = await tx.loan.update({
                where: { id: loanId },
                data: {
                    repaidAmount: newRepaidAmount,
                    repaymentStatus: newRepaidAmount >= total ? 'Paid' : 'Unpaid'
                },
                include: {
                    payments: { orderBy: { date: 'asc' } },
                    product: true,
                }
            });
            return finalLoan;
        });

        return NextResponse.json(updatedLoan, { status: 200 });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error processing payment:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
