
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
        
        const { total, principal, interest, penalty, serviceFee } = calculateTotalRepayable(loan as any, loan.product, new Date());
        const alreadyRepaid = loan.repaidAmount || 0;
        
        const totalDue = total - alreadyRepaid;

        // The principalDue calculation was incorrect. It should just be the loan's principal amount.
        // The serviceFee is separate. Let's calculate what part of the repayment goes to each component.
        const serviceFeeAlreadyPaid = Math.max(0, alreadyRepaid - (total - serviceFee));
        const serviceFeeDue = Math.max(0, serviceFee - serviceFeeAlreadyPaid);

        const interestAlreadyPaid = Math.max(0, alreadyRepaid - (total - interest - serviceFee));
        const interestDue = Math.max(0, interest - interestAlreadyPaid);

        const penaltyAlreadyPaid = Math.max(0, alreadyRepaid - (total - penalty - interest - serviceFee));
        const penaltyDue = Math.max(0, penalty - penaltyAlreadyPaid);

        const principalAlreadyPaid = Math.max(0, alreadyRepaid - serviceFee - interest - penalty);
        const principalDue = Math.max(0, principal - principalAlreadyPaid);


        if (paymentAmount > totalDue + 0.01) { // Add tolerance for floating point
             return NextResponse.json({ error: 'Payment amount exceeds balance due.' }, { status: 400 });
        }
        
        const updatedLoan = await prisma.$transaction(async (tx) => {
            let amountToApply = paymentAmount;
            
            // Ledger Accounts
            const principalReceivable = provider.ledgerAccounts.find(a => a.category === 'Principal' && a.type === 'Receivable');
            const interestReceivable = provider.ledgerAccounts.find(a => a.category === 'Interest' && a.type === 'Receivable');
            const penaltyReceivable = provider.ledgerAccounts.find(a => a.category === 'Penalty' && a.type === 'Receivable');
            const serviceFeeReceivable = provider.ledgerAccounts.find(a => a.category === 'ServiceFee' && a.type === 'Receivable');

            const principalReceived = provider.ledgerAccounts.find(a => a.category === 'Principal' && a.type === 'Received');
            const interestReceived = provider.ledgerAccounts.find(a => a.category === 'Interest' && a.type === 'Received');
            const penaltyReceived = provider.ledgerAccounts.find(a => a.category === 'Penalty' && a.type === 'Received');
            const serviceFeeReceived = provider.ledgerAccounts.find(a => a.category === 'ServiceFee' && a.type === 'Received');
            
            
            if (!principalReceivable || !interestReceivable || !penaltyReceivable || !serviceFeeReceivable ||
                !principalReceived || !interestReceived || !penaltyReceived || !serviceFeeReceived) {
                throw new Error(`One or more ledger accounts not found for provider ${provider.id}`);
            }

            // Apply payment according to priority: Penalty -> Service Fee -> Interest -> Principal
            const penaltyToPay = Math.min(amountToApply, penaltyDue);
            if (penaltyToPay > 0) {
                await tx.ledgerAccount.update({ where: { id: penaltyReceivable.id }, data: { balance: { decrement: penaltyToPay } } });
                await tx.ledgerAccount.update({ where: { id: penaltyReceived.id }, data: { balance: { increment: penaltyToPay } } });
                amountToApply -= penaltyToPay;
            }

            const serviceFeeToPay = Math.min(amountToApply, serviceFeeDue);
            if (serviceFeeToPay > 0) {
                await tx.ledgerAccount.update({ where: { id: serviceFeeReceivable.id }, data: { balance: { decrement: serviceFeeToPay } } });
                await tx.ledgerAccount.update({ where: { id: serviceFeeReceived.id }, data: { balance: { increment: serviceFeeToPay } } });
                amountToApply -= serviceFeeToPay;
            }

            const interestToPay = Math.min(amountToApply, interestDue);
             if (interestToPay > 0) {
                await tx.ledgerAccount.update({ where: { id: interestReceivable.id }, data: { balance: { decrement: interestToPay } } });
                await tx.ledgerAccount.update({ where: { id: interestReceived.id }, data: { balance: { increment: interestToPay } } });
                amountToApply -= interestToPay;
            }
            
            const principalToPay = Math.min(amountToApply, principalDue);
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

            const newRepaidAmount = alreadyRepaid + paymentAmount;
            
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
