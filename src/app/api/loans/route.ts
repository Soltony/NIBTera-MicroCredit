
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { loanCreationSchema } from '@/lib/schemas';
import { checkLoanEligibility } from '@/actions/eligibility';
import { createAuditLog } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
    let loanDetailsForLogging: any = {};
    try {
        const body = await req.json();
        // Use the new schema without serviceFee
        const data = loanCreationSchema.parse(body);
        loanDetailsForLogging = { ...data };

        const logDetails = {
            borrowerId: data.borrowerId,
            productId: data.productId,
            amount: data.loanAmount,
        };

        await createAuditLog({ actorId: 'system', action: 'LOAN_DISBURSEMENT_INITIATED', entity: 'LOAN', details: logDetails });
        console.log(JSON.stringify({ ...logDetails, timestamp: new Date().toISOString(), action: 'LOAN_DISBURSEMENT_INITIATED' }));

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
            throw new Error('Product not found');
        }

        // --- SERVER-SIDE VALIDATION ---
        const { isEligible, maxLoanAmount, reason } = await checkLoanEligibility(data.borrowerId, product.providerId, data.productId);

        if (!isEligible) {
            throw new Error(`Loan denied: ${reason}`);
        }

        if (data.loanAmount > maxLoanAmount) {
            throw new Error(`Requested amount of ${data.loanAmount} exceeds the maximum allowed limit of ${maxLoanAmount}.`);
        }
        // --- END OF VALIDATION ---
        
        // --- CALCULATION LOGIC MOVED TO BACKEND ---
        // Create a temporary loan object to calculate the service fee
        const tempLoanForCalc = {
            id: 'temp',
            loanAmount: data.loanAmount,
            disbursedDate: new Date(data.disbursedDate),
            dueDate: new Date(data.dueDate),
            serviceFee: 0, // This will be calculated
            repaymentStatus: 'Unpaid' as 'Unpaid' | 'Paid',
            payments: [],
            productName: product.name,
            providerName: product.provider.name,
            repaidAmount: 0,
            penaltyAmount: 0,
            product: product as any, // Attach product for context, though it's passed separately now
        };
        
        // Use the centralized calculator to get the correct service fee
        // Pass the original `product` object directly to ensure all flags are read correctly.
        const { serviceFee: calculatedServiceFee } = calculateTotalRepayable(tempLoanForCalc, product, new Date(data.disbursedDate));
        // --- END OF NEW CALCULATION LOGIC ---

        const provider = product.provider;

        const principalReceivableAccount = provider.ledgerAccounts.find(acc => acc.category === 'Principal' && acc.type === 'Receivable');
        const serviceFeeReceivableAccount = provider.ledgerAccounts.find(acc => acc.category === 'ServiceFee' && acc.type === 'Receivable');
        const serviceFeeIncomeAccount = provider.ledgerAccounts.find(acc => acc.category === 'ServiceFee' && acc.type === 'Income');

        if (!principalReceivableAccount) {
            throw new Error('Principal Receivable ledger account not found for this provider.');
        }
        if (calculatedServiceFee > 0 && (!serviceFeeReceivableAccount || !serviceFeeIncomeAccount)) {
            throw new Error('Service Fee ledger accounts not configured for this provider.');
        }


        const newLoan = await prisma.$transaction(async (tx) => {
            // Create the loan with the server-calculated service fee
            const createdLoan = await tx.loan.create({
                data: {
                    borrowerId: data.borrowerId,
                    productId: data.productId,
                    loanAmount: data.loanAmount,
                    serviceFee: calculatedServiceFee,
                    penaltyAmount: 0, // Penalty is always 0 at disbursement
                    disbursedDate: data.disbursedDate,
                    dueDate: data.dueDate,
                    repaymentStatus: 'Unpaid',
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
            if (calculatedServiceFee > 0 && serviceFeeReceivableAccount && serviceFeeIncomeAccount) {
                await tx.ledgerEntry.createMany({
                    data: [
                         // Debit: Service Fee Receivable (Asset ↑)
                        {
                            journalEntryId: journalEntry.id,
                            ledgerAccountId: serviceFeeReceivableAccount.id,
                            type: 'Debit',
                            amount: calculatedServiceFee
                        },
                        // Credit: Service Fee Income (Income ↑)
                        {
                            journalEntryId: journalEntry.id,
                            ledgerAccountId: serviceFeeIncomeAccount.id,
                            type: 'Credit',
                            amount: calculatedServiceFee
                        }
                    ]
                });
            }

            // Update Balances
            await tx.ledgerAccount.update({
                where: { id: principalReceivableAccount.id },
                data: { balance: { increment: data.loanAmount } }
            });
            if (calculatedServiceFee > 0 && serviceFeeReceivableAccount && serviceFeeIncomeAccount) {
                await tx.ledgerAccount.update({ where: { id: serviceFeeReceivableAccount.id }, data: { balance: { increment: calculatedServiceFee } } });
                await tx.ledgerAccount.update({ where: { id: serviceFeeIncomeAccount.id }, data: { balance: { increment: calculatedServiceFee } } });
            }

            // Credit: Provider Fund (Asset ↓)
            await tx.loanProvider.update({
                where: { id: provider.id },
                data: { initialBalance: { decrement: data.loanAmount } }
            });
            
            return createdLoan;
        });

        const successLogDetails = {
            loanId: newLoan.id,
            borrowerId: newLoan.borrowerId,
            productId: newLoan.productId,
            amount: newLoan.loanAmount,
            serviceFee: newLoan.serviceFee,
        };
        await createAuditLog({ actorId: 'system', action: 'LOAN_DISBURSEMENT_SUCCESS', entity: 'LOAN', entityId: newLoan.id, details: successLogDetails });
        console.log(JSON.stringify({ ...successLogDetails, timestamp: new Date().toISOString(), action: 'LOAN_DISBURSEMENT_SUCCESS' }));

        return NextResponse.json(newLoan, { status: 201 });

    } catch (error) {
        const errorMessage = (error instanceof z.ZodError) ? error.errors : (error as Error).message;
        const failureLogDetails = {
            ...loanDetailsForLogging,
            error: errorMessage,
        };
        await createAuditLog({ actorId: 'system', action: 'LOAN_DISBURSEMENT_FAILED', entity: 'LOAN', details: failureLogDetails });
        console.error(JSON.stringify({ ...failureLogDetails, timestamp: new Date().toISOString(), action: 'LOAN_DISBURSEMENT_FAILED' }));

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    }
}
