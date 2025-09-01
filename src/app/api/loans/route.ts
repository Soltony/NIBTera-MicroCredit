
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
            
            // Create Journal Entry for the disbursement
            const journalEntry = await tx.journalEntry.create({
                data: {
                    providerId: provider.id,
                    loanId: createdLoan.id,
                    date: new Date(data.disbursedDate),
                    description: `Loan disbursement for ${product.name} to borrower ${data.borrowerId}`,
                }
            });
            
            // Ledger Entry for Principal: Debit Receivable, Credit Provider Fund
            await tx.ledgerEntry.createMany({
                data: [
                    // Debit: Loan Principal Receivable (Asset ↑)
                    {
                        journalEntryId: journalEntry.id,
                        ledgerAccountId: principalReceivableAccount.id,
                        type: 'Debit',
                        amount: data.loanAmount
                    }
                ]
            });
            
            // Ledger Entry for Service Fee if applicable
            if (data.serviceFee > 0 && serviceFeeReceivableAccount && serviceFeeIncomeAccount) {
                await tx.ledgerEntry.createMany({
                    data: [
                         // Debit: Service Fee Receivable (Asset ↑)
                        {
                            journalEntryId: journalEntry.id,
                            ledgerAccountId: serviceFeeReceivableAccount.id,
                            type: 'Debit',
                            amount: data.serviceFee
                        },
                        // Credit: Service Fee Income (Income ↑)
                        {
                            journalEntryId: journalEntry.id,
                            ledgerAccountId: serviceFeeIncomeAccount.id,
                            type: 'Credit',
                            amount: data.serviceFee
                        }
                    ]
                });
            }

            // Update Balances
            await tx.ledgerAccount.update({
                where: { id: principalReceivableAccount.id },
                data: { balance: { increment: data.loanAmount } }
            });
            if (data.serviceFee > 0 && serviceFeeReceivableAccount && serviceFeeIncomeAccount) {
                await tx.ledgerAccount.update({ where: { id: serviceFeeReceivableAccount.id }, data: { balance: { increment: data.serviceFee } } });
                await tx.ledgerAccount.update({ where: { id: serviceFeeIncomeAccount.id }, data: { balance: { increment: data.serviceFee } } });
            }

            // Credit: Provider Fund (Asset ↓)
            await tx.loanProvider.update({
                where: { id: provider.id },
                data: { initialBalance: { decrement: data.loanAmount } }
            });
            
            return createdLoan;
        });

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            action: 'LOAN_DISBURSEMENT_SUCCESS',
            actorId: 'system', // Or could be a user ID if an admin initiated it
            details: {
                loanId: newLoan.id,
                borrowerId: newLoan.borrowerId,
                productId: newLoan.productId,
                amount: newLoan.loanAmount,
            }
        }));

        return NextResponse.json(newLoan, { status: 201 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error creating loan:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
