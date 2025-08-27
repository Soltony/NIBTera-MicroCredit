
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const loanSchema = z.object({
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

        const product = await prisma.loanProduct.findUnique({
            where: { id: data.productId },
            include: { 
                provider: {
                    include: {
                        ledgerAccounts: true
                    }
                }
            }
        });

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }
        
        const provider = product.provider;

        const principalReceivableAccount = provider.ledgerAccounts.find(acc => acc.category === 'Principal' && acc.type === 'Receivable');
        const serviceFeeReceivableAccount = provider.ledgerAccounts.find(acc => acc.category === 'ServiceFee' && acc.type === 'Receivable');
        const serviceFeeIncomeAccount = provider.ledgerAccounts.find(acc => acc.category === 'ServiceFee' && acc.type === 'Income');

        if (!principalReceivableAccount) {
            return NextResponse.json({ error: 'Principal Receivable ledger account not found for this provider.' }, { status: 400 });
        }
        if (data.serviceFee > 0 && (!serviceFeeReceivableAccount || !serviceFeeIncomeAccount)) {
            return NextResponse.json({ error: 'Service Fee ledger accounts not configured for this provider.' }, { status: 400 });
        }


        const newLoan = await prisma.$transaction(async (tx) => {
            // Create the loan
            const createdLoan = await tx.loan.create({
                data: {
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

            // Debit: Service Fee Receivable (Asset ↑) & Credit: Service Fee Income (Income ↑)
            if (data.serviceFee > 0 && serviceFeeReceivableAccount && serviceFeeIncomeAccount) {
                await tx.ledgerAccount.update({
                    where: { id: serviceFeeReceivableAccount.id },
                    data: { balance: { increment: data.serviceFee } }
                });
                 await tx.ledgerAccount.update({
                    where: { id: serviceFeeIncomeAccount.id },
                    data: { balance: { increment: data.serviceFee } }
                });
            }

            // Credit: Provider Fund (Asset ↓)
            await tx.loanProvider.update({
                where: { id: provider.id },
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
