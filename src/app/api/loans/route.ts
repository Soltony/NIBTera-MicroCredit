
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const loanSchema = z.object({
    providerId: z.string(),
    productId: z.string(),
    borrowerId: z.string(),
    loanAmount: z.number(),
    serviceFee: z.number(),
    penaltyAmount: z.number(),
    disbursedDate: z.string().datetime(),
    dueDate: z.string().datetime(),
    repaymentStatus: z.enum(['Paid', 'Unpaid']),
});


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = loanSchema.parse(body);

        const provider = await prisma.loanProvider.findUnique({
            where: { id: data.providerId },
            include: { ledgerAccounts: true }
        });

        if (!provider) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        const principalReceivableAccount = provider.ledgerAccounts.find(acc => acc.category === 'Principal' && acc.type === 'Receivable');
        if (!principalReceivableAccount) {
            return NextResponse.json({ error: 'Principal Receivable ledger account not found for this provider.' }, { status: 400 });
        }

        const newLoan = await prisma.$transaction(async (tx) => {
            // Create the loan
            const createdLoan = await tx.loan.create({
                data: {
                    providerId: data.providerId,
                    borrowerId: data.borrowerId,
                    productId: data.productId,
                    loanAmount: data.loanAmount,
                    serviceFee: data.serviceFee,
                    penaltyAmount: data.penaltyAmount,
                    disbursedDate: data.disbursedDate,
                    dueDate: data.dueDate,
                    repaymentStatus: data.repaymentStatus,
                    repaidAmount: 0,
                }
            });

            // Debit: Loan Principal Receivable (Asset ↑)
            await tx.ledgerAccount.update({
                where: { id: principalReceivableAccount.id },
                data: { balance: { increment: data.loanAmount } }
            });

            // Credit: Provider Fund (Asset ↓)
            await tx.loanProvider.update({
                where: { id: data.providerId },
                data: { initialBalance: { decrement: data.loanAmount } }
            });
            
            return createdLoan;
        });

        return NextResponse.json(newLoan, { status: 201 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error creating loan:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
