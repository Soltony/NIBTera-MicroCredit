
import { NextResponse } from 'next/server';
import { AppDataSource } from '@/data-source';
import { LoanDetails } from '@/entities/LoanDetails';
import { Payment } from '@/entities/Payment';
import { calculateTotalRepayable } from '@/lib/types';
import { z } from 'zod';

const paymentSchema = z.object({
  loanId: z.string(),
  amount: z.number().positive('Payment amount must be positive.'),
});

export async function POST(req: Request) {
    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
        const loanRepo = AppDataSource.getRepository(LoanDetails);
        const paymentRepo = AppDataSource.getRepository(Payment);
        const manager = AppDataSource.manager;

        const body = await req.json();
        const validation = paymentSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }

        const { loanId, amount } = validation.data;
        const numericLoanId = Number(loanId);

        return await manager.transaction(async (transactionalEntityManager) => {
            const loan = await transactionalEntityManager.findOne(LoanDetails, {
                where: { id: numericLoanId },
                relations: ['payments', 'provider', 'product'],
            });

            if (!loan) {
                return NextResponse.json({ error: 'Loan not found.' }, { status: 404 });
            }

            // Calculate current total repayable amount
            const totalRepayable = calculateTotalRepayable(loan, new Date());
            const outstandingBalance = totalRepayable - (loan.repaidAmount || 0);

            if (amount > outstandingBalance + 0.01) { // Add tolerance for floating point
                return NextResponse.json({ error: 'Payment amount exceeds outstanding balance.' }, { status: 400 });
            }

            // Create and save new payment record
            const newPayment = transactionalEntityManager.create(Payment, {
                loanId: numericLoanId,
                amount: amount,
                date: new Date(),
                outstandingBalanceBeforePayment: outstandingBalance,
            });
            await transactionalEntityManager.save(newPayment);

            // Update loan details
            const totalRepaid = (loan.repaidAmount || 0) + amount;
            loan.repaidAmount = totalRepaid;

            // Check if loan is fully paid
            if (totalRepaid >= totalRepayable - 0.01) { // Use tolerance
                loan.repaymentStatus = 'Paid';
            }

            const updatedLoan = await transactionalEntityManager.save(loan);
            
            // Reload relations to return the full object
            const finalLoan = await transactionalEntityManager.findOne(LoanDetails, {
                where: { id: updatedLoan.id },
                relations: ['payments', 'provider', 'product'],
            });

            return NextResponse.json({
                ...finalLoan,
                id: String(finalLoan!.id),
                providerName: finalLoan!.provider.name,
                productName: finalLoan!.product.name,
            }, { status: 200 });
        });

    } catch (error) {
        console.error('Error processing payment:', error);
        return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
    }
}
