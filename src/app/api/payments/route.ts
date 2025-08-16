
import { NextResponse } from 'next/server';
import { AppDataSource } from '@/data-source';
import { LoanDetails } from '@/entities/LoanDetails';
import { Payment } from '@/entities/Payment';
import { calculateTotalRepayable } from '@/lib/utils';
import { z } from 'zod';
import type { DataSource } from 'typeorm';

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

const paymentSchema = z.object({
  loanId: z.string(),
  amount: z.number().positive('Payment amount must be positive.'),
});

export async function POST(req: Request) {
    try {
        const dataSource = await getConnectedDataSource();
        const manager = dataSource.manager;

        const body = await req.json();
        const validation = paymentSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 });
        }

        const { loanId, amount } = validation.data;
        const numericLoanId = Number(loanId);

        return await manager.transaction(async (transactionalEntityManager) => {
            const loanRepo = transactionalEntityManager.getRepository(LoanDetails);
            const paymentRepo = transactionalEntityManager.getRepository(Payment);

            const loan = await loanRepo.findOne({
                where: { id: numericLoanId },
                relations: ['provider', 'product'],
            });

            if (!loan) {
                return NextResponse.json({ error: 'Loan not found.' }, { status: 404 });
            }

            const loanProduct = {
                ...loan.product,
                serviceFee: JSON.parse(loan.product.serviceFee),
                dailyFee: JSON.parse(loan.product.dailyFee),
                penaltyRules: JSON.parse(loan.product.penaltyRules),
            }

            // Calculate current total repayable amount
            const totalRepayable = calculateTotalRepayable(loan, loanProduct, new Date());
            const alreadyPaid = loan.repaidAmount || 0;
            const outstandingBalance = totalRepayable - alreadyPaid;

            if (amount > outstandingBalance + 0.01) { // Add tolerance for floating point
                return NextResponse.json({ error: 'Payment amount exceeds outstanding balance.' }, { status: 400 });
            }

            // Create and save new payment record first
            const newPayment = paymentRepo.create({
                loanId: numericLoanId,
                amount: amount,
                date: new Date(),
                outstandingBalanceBeforePayment: outstandingBalance,
            });
            await paymentRepo.save(newPayment);

            // Update loan details
            const totalRepaid = alreadyPaid + amount;
            loan.repaidAmount = totalRepaid;

            // Check if loan is fully paid
            if (totalRepaid >= totalRepayable - 0.01) { // Use tolerance
                loan.repaymentStatus = 'Paid';
            }

            // Save the updated loan object
            await loanRepo.save(loan);
            
            // Reload the loan with all its relations to return the full, updated object
            const finalLoan = await loanRepo.findOne({
                where: { id: loan.id },
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
