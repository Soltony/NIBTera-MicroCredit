
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { loanCreationSchema } from '@/lib/schemas';
import { checkLoanEligibility } from '@/actions/eligibility';
import { createAuditLog } from '@/lib/audit-log';

async function handlePersonalLoan(data: z.infer<typeof loanCreationSchema>, product: any) {
    const provider = product.provider;
    
    const tempLoanForCalc = {
        id: 'temp',
        loanAmount: data.loanAmount,
        disbursedDate: new Date(data.disbursedDate),
        dueDate: new Date(data.dueDate),
        serviceFee: 0,
        repaymentStatus: 'Unpaid' as 'Unpaid' | 'Paid',
        payments: [],
        productName: product.name,
        providerName: product.provider.name,
        repaidAmount: 0,
        penaltyAmount: 0,
        product: product as any,
    };
    const { serviceFee: calculatedServiceFee } = calculateTotalRepayable(tempLoanForCalc, product, new Date(data.disbursedDate));

    // Ledger Account Checks
    const principalReceivableAccount = provider.ledgerAccounts.find((acc: any) => acc.category === 'Principal' && acc.type === 'Receivable');
    const serviceFeeReceivableAccount = provider.ledgerAccounts.find((acc: any) => acc.category === 'ServiceFee' && acc.type === 'Receivable');
    const serviceFeeIncomeAccount = provider.ledgerAccounts.find((acc: any) => acc.category === 'ServiceFee' && acc.type === 'Income');
    if (!principalReceivableAccount) throw new Error('Principal Receivable ledger account not found.');
    if (calculatedServiceFee > 0 && (!serviceFeeReceivableAccount || !serviceFeeIncomeAccount)) throw new Error('Service Fee ledger accounts not configured.');

    return await prisma.$transaction(async (tx) => {
        // For personal loans, we create the application and the loan.
        // Step 1: Create the LoanApplication record.
        const loanApplication = await tx.loanApplication.create({
            data: {
                borrowerId: data.borrowerId,
                productId: data.productId,
                loanAmount: data.loanAmount,
                status: 'DISBURSED', // Personal loans are disbursed immediately
            }
        });

        // Step 2: Create the Loan record and connect it to the application.
        const createdLoan = await tx.loan.create({
            data: {
                borrowerId: data.borrowerId,
                productId: data.productId,
                loanApplicationId: loanApplication.id, // Link to the created application
                loanAmount: data.loanAmount,
                disbursedDate: data.disbursedDate,
                dueDate: data.dueDate,
                serviceFee: calculatedServiceFee,
                penaltyAmount: 0,
                repaymentStatus: 'Unpaid',
                repaidAmount: 0,
            }
        });
        
        const journalEntry = await tx.journalEntry.create({
            data: {
                providerId: provider.id,
                loanId: createdLoan.id,
                date: new Date(data.disbursedDate),
                description: `Loan disbursement for ${product.name} to borrower ${data.borrowerId}`,
            }
        });
        
        await tx.ledgerEntry.createMany({
            data: [{
                journalEntryId: journalEntry.id,
                ledgerAccountId: principalReceivableAccount.id,
                type: 'Debit',
                amount: data.loanAmount
            }]
        });
        
        if (calculatedServiceFee > 0 && serviceFeeReceivableAccount && serviceFeeIncomeAccount) {
            await tx.ledgerEntry.createMany({
                data: [
                    { journalEntryId: journalEntry.id, ledgerAccountId: serviceFeeReceivableAccount.id, type: 'Debit', amount: calculatedServiceFee },
                    { journalEntryId: journalEntry.id, ledgerAccountId: serviceFeeIncomeAccount.id, type: 'Credit', amount: calculatedServiceFee }
                ]
            });
            await tx.ledgerAccount.update({ where: { id: serviceFeeReceivableAccount.id }, data: { balance: { increment: calculatedServiceFee } } });
            await tx.ledgerAccount.update({ where: { id: serviceFeeIncomeAccount.id }, data: { balance: { increment: calculatedServiceFee } } });
        }

        await tx.ledgerAccount.update({ where: { id: principalReceivableAccount.id }, data: { balance: { increment: data.loanAmount } } });
        await tx.loanProvider.update({ where: { id: provider.id }, data: { initialBalance: { decrement: data.loanAmount } } });
        
        return createdLoan;
    });
}


async function handleSmeLoan(data: z.infer<typeof loanCreationSchema>, product: any) {
    if (!data.loanApplicationId) {
        throw new Error('SME loan disbursement requires a valid Loan Application ID.');
    }

    const application = await prisma.loanApplication.findUnique({ where: { id: data.loanApplicationId } });

    if (!application) {
        throw new Error('Loan Application not found.');
    }
    if (application.status !== 'APPROVED') {
        throw new Error(`Cannot disburse loan. Application status is "${application.status}", but must be "APPROVED".`);
    }

    const provider = product.provider;
    const tempLoanForCalc = { /* ... as in handlePersonalLoan ... */ };
    const { serviceFee: calculatedServiceFee } = calculateTotalRepayable({
        id: 'temp',
        loanAmount: data.loanAmount,
        disbursedDate: new Date(data.disbursedDate),
        dueDate: new Date(data.dueDate),
        serviceFee: 0,
        repaymentStatus: 'Unpaid' as const,
        payments: [],
        productName: product.name,
        providerName: provider.name,
        repaidAmount: 0,
        penaltyAmount: 0,
        product: product as any,
    }, product, new Date(data.disbursedDate));

    // Ledger Account Checks
    const principalReceivableAccount = provider.ledgerAccounts.find((acc: any) => acc.category === 'Principal' && acc.type === 'Receivable');
    if (!principalReceivableAccount) throw new Error('Principal Receivable ledger account not found.');
    // ... other account checks ...

    return await prisma.$transaction(async (tx) => {
        const createdLoan = await tx.loan.create({
            data: {
                borrowerId: data.borrowerId,
                productId: data.productId,
                loanAmount: data.loanAmount,
                disbursedDate: data.disbursedDate,
                dueDate: data.dueDate,
                serviceFee: calculatedServiceFee,
                penaltyAmount: 0,
                repaymentStatus: 'Unpaid',
                repaidAmount: 0,
                loanApplicationId: data.loanApplicationId!, // It's guaranteed to be here
            }
        });
        
        // Update the application status to DISBURSED
        await tx.loanApplication.update({
            where: { id: data.loanApplicationId },
            data: {
                status: 'DISBURSED',
            }
        });

        // Journal Entry and Ledger updates...
        const journalEntry = await tx.journalEntry.create({
            data: {
                providerId: provider.id,
                loanId: createdLoan.id,
                date: new Date(data.disbursedDate),
                description: `SME Loan disbursement for ${product.name} to borrower ${data.borrowerId}`,
            }
        });
        await tx.ledgerEntry.create({ data: { journalEntryId: journalEntry.id, ledgerAccountId: principalReceivableAccount.id, type: 'Debit', amount: data.loanAmount }});
        await tx.ledgerAccount.update({ where: { id: principalReceivableAccount.id }, data: { balance: { increment: data.loanAmount } } });
        await tx.loanProvider.update({ where: { id: provider.id }, data: { initialBalance: { decrement: data.loanAmount } } });

        return createdLoan;
    });
}


export async function POST(req: NextRequest) {
    let loanDetailsForLogging: any = {};
    try {
        const body = await req.json();
        const data = loanCreationSchema.parse(body);
        loanDetailsForLogging = { ...data };

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
            throw new Error('Loan product not found.');
        }

        const logDetails = { borrowerId: data.borrowerId, productId: data.productId, amount: data.loanAmount };
        await createAuditLog({ actorId: 'system', action: 'LOAN_DISBURSEMENT_INITIATED', entity: 'LOAN', details: logDetails });

        // --- SERVER-SIDE VALIDATION ---
        const { isEligible, maxLoanAmount, reason } = await checkLoanEligibility(data.borrowerId, product.providerId, product.id);

        if (!isEligible) {
            throw new Error(`Loan denied: ${reason}`);
        }

        if (data.loanAmount > maxLoanAmount) {
            throw new Error(`Requested amount of ${data.loanAmount} exceeds the maximum allowed limit of ${maxLoanAmount}.`);
        }
        // --- END OF VALIDATION ---

        let newLoan;
        if (product.productType === 'SME') {
            newLoan = await handleSmeLoan(data, product);
        } else {
            newLoan = await handlePersonalLoan(data, product);
        }

        const successLogDetails = {
            loanId: newLoan.id,
            borrowerId: newLoan.borrowerId,
            productId: newLoan.productId,
            amount: newLoan.loanAmount,
            serviceFee: newLoan.serviceFee,
        };
        await createAuditLog({ actorId: 'system', action: 'LOAN_DISBURSEMENT_SUCCESS', entity: 'LOAN', entityId: newLoan.id, details: successLogDetails });

        return NextResponse.json(newLoan, { status: 201 });

    } catch (error) {
        const errorMessage = (error instanceof z.ZodError) ? error.errors : (error as Error).message;
        const failureLogDetails = {
            ...loanDetailsForLogging,
            error: errorMessage,
        };
        await createAuditLog({ actorId: 'system', action: 'LOAN_DISBURSEMENT_FAILED', entity: 'LOAN', details: failureLogDetails });

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error("Error in POST /api/loans:", error);
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    }
}

    