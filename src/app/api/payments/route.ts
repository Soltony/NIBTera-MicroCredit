
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const paymentSchema = z.object({
  loanId: z.string(),
  amount: z.number().positive(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { loanId, amount } = paymentSchema.parse(body);

        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: { product: true }
        });

        if (!loan) {
            return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
        }
        
        // This is a simplified repayment logic.
        // A real-world scenario would use the loan-calculator to get the exact balance.
        const newRepaidAmount = (loan.repaidAmount || 0) + amount;
        
        // Create payment record
        await prisma.payment.create({
            data: {
                loanId,
                amount,
                date: new Date(),
                outstandingBalanceBeforePayment: loan.loanAmount - (loan.repaidAmount || 0), // Simplified
            }
        });
        
        // Update loan status
        const updatedLoan = await prisma.loan.update({
            where: { id: loanId },
            data: {
                repaidAmount: newRepaidAmount,
                // A more robust check against total repayable is needed here.
                // For now, we assume if paid amount >= loan amount, it's Paid.
                repaymentStatus: newRepaidAmount >= loan.loanAmount ? 'Paid' : 'Unpaid'
            },
            include: {
                payments: { orderBy: { date: 'asc' } },
                product: true,
            }
        });
        
        // If loan is fully paid, update customer's on-time repayment history
        if (updatedLoan.repaymentStatus === 'Paid') {
            const customer = await prisma.customer.findUnique({ where: { id: loan.customerId } });
            if (customer) {
                const loanHistory = JSON.parse(customer.loanHistory);
                const isPaidOnTime = new Date() <= new Date(loan.dueDate);
                if (isPaidOnTime) {
                    loanHistory.onTimeRepayments += 1;
                }
                await prisma.customer.update({
                    where: { id: loan.customerId },
                    data: { loanHistory: JSON.stringify(loanHistory) }
                });
            }
        }

        return NextResponse.json(updatedLoan, { status: 200 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error processing payment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
