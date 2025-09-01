
'use server';
/**
 * @fileOverview Implements the logic for loan repayments, including automated deductions.
 *
 * - processAutomatedRepayments - A service that finds overdue loans and attempts to deduct payment from customer accounts.
 */

import prisma from '@/lib/prisma';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { startOfDay } from 'date-fns';

async function getBorrowerBalance(borrowerId: string): Promise<number> {
    // In a real system, this would call a banking API.
    // Here, we simulate it by checking the latest provisioned data for a balance field.
    const provisionedData = await prisma.provisionedData.findFirst({
        where: { borrowerId },
        orderBy: { createdAt: 'desc' },
    });

    if (provisionedData) {
        try {
            const data = JSON.parse(provisionedData.data as string);
            // Assuming the provisioned data has a field named 'accountBalance'
            return parseFloat(data.accountBalance) || 0;
        } catch (e) {
            return 0; // Return 0 if data is not valid JSON or balance is not a number
        }
    }
    return 0;
}

export async function processAutomatedRepayments(): Promise<{ success: boolean; message: string; processedCount: number }> {
    console.log('Starting automated repayment process...');
    const today = startOfDay(new Date());

    // 1. Find all overdue loans
    const overdueLoans = await prisma.loan.findMany({
        where: {
            repaymentStatus: 'Unpaid',
            dueDate: {
                lt: today,
            },
        },
        include: {
            product: {
                include: {
                    provider: {
                        include: {
                            ledgerAccounts: true,
                        }
                    }
                }
            }
        },
    });

    if (overdueLoans.length === 0) {
        console.log('No overdue loans found.');
        return { success: true, message: 'No overdue loans to process.', processedCount: 0 };
    }

    let processedCount = 0;

    for (const loan of overdueLoans) {
        const { total, principal, interest, penalty } = calculateTotalRepayable(loan as any, loan.product, today);
        const totalDue = total - (loan.repaidAmount || 0);

        if (totalDue <= 0) {
            continue; // Skip if already paid off
        }

        const borrowerBalance = await getBorrowerBalance(loan.borrowerId);
        
        if (borrowerBalance >= totalDue) {
            try {
                await prisma.$transaction(async (tx) => {
                    const provider = loan.product.provider;
                    
                    // Ledger Accounts
                    const principalReceivable = provider.ledgerAccounts.find(a => a.category === 'Principal' && a.type === 'Receivable');
                    const interestReceivable = provider.ledgerAccounts.find(a => a.category === 'Interest' && a.type === 'Receivable');
                    const penaltyReceivable = provider.ledgerAccounts.find(a => a.category === 'Penalty' && a.type === 'Receivable');
                    const principalReceived = provider.ledgerAccounts.find(a => a.category === 'Principal' && a.type === 'Received');
                    const interestReceived = provider.ledgerAccounts.find(a => a.category === 'Interest' && a.type === 'Received');
                    const penaltyReceived = provider.ledgerAccounts.find(a => a.category === 'Penalty' && a.type === 'Received');
                    
                    if (!principalReceivable || !interestReceivable || !penaltyReceivable || !principalReceived || !interestReceived || !penaltyReceived) {
                        throw new Error(`One or more ledger accounts not found for provider ${provider.id}`);
                    }
                    
                     const journalEntry = await tx.journalEntry.create({
                        data: {
                            providerId: provider.id,
                            loanId: loan.id,
                            date: today,
                            description: `Automated repayment for loan ${loan.id}`,
                        }
                    });
                    
                    let paymentAmount = totalDue;

                    // Apply payment according to priority: Penalty -> Interest -> Principal
                    const penaltyToPay = Math.min(paymentAmount, penalty);
                    if (penaltyToPay > 0) {
                        await tx.ledgerAccount.update({ where: { id: penaltyReceivable.id }, data: { balance: { decrement: penaltyToPay } } });
                        await tx.ledgerAccount.update({ where: { id: penaltyReceived.id }, data: { balance: { increment: penaltyToPay } } });
                         await tx.ledgerEntry.createMany({ data: [
                            { journalEntryId: journalEntry.id, ledgerAccountId: penaltyReceivable.id, type: 'Credit', amount: penaltyToPay },
                            { journalEntryId: journalEntry.id, ledgerAccountId: penaltyReceived.id, type: 'Debit', amount: penaltyToPay }
                        ]});
                        paymentAmount -= penaltyToPay;
                    }

                    const interestToPay = Math.min(paymentAmount, interest);
                     if (interestToPay > 0) {
                        await tx.ledgerAccount.update({ where: { id: interestReceivable.id }, data: { balance: { decrement: interestToPay } } });
                        await tx.ledgerAccount.update({ where: { id: interestReceived.id }, data: { balance: { increment: interestToPay } } });
                         await tx.ledgerEntry.createMany({ data: [
                            { journalEntryId: journalEntry.id, ledgerAccountId: interestReceivable.id, type: 'Credit', amount: interestToPay },
                            { journalEntryId: journalEntry.id, ledgerAccountId: interestReceived.id, type: 'Debit', amount: interestToPay }
                        ]});
                        paymentAmount -= interestToPay;
                    }
                    
                    const principalToPay = Math.min(paymentAmount, principal);
                     if (principalToPay > 0) {
                        await tx.ledgerAccount.update({ where: { id: principalReceivable.id }, data: { balance: { decrement: principalToPay } } });
                        await tx.ledgerAccount.update({ where: { id: principalReceived.id }, data: { balance: { increment: principalToPay } } });
                        await tx.ledgerEntry.createMany({ data: [
                            { journalEntryId: journalEntry.id, ledgerAccountId: principalReceivable.id, type: 'Credit', amount: principalToPay },
                            { journalEntryId: journalEntry.id, ledgerAccountId: principalReceived.id, type: 'Debit', amount: principalToPay }
                        ]});
                    }
                    
                    // Create payment record
                    await tx.payment.create({
                        data: {
                            loanId: loan.id,
                            amount: totalDue,
                            date: today,
                            outstandingBalanceBeforePayment: totalDue,
                            journalEntryId: journalEntry.id,
                        },
                    });

                    // Update loan status
                    await tx.loan.update({
                        where: { id: loan.id },
                        data: {
                            repaidAmount: (loan.repaidAmount || 0) + totalDue,
                            repaymentStatus: 'Paid',
                        },
                    });
                });
                
                processedCount++;
                console.log(`Successfully processed repayment for loan ${loan.id}.`);

            } catch (error) {
                console.error(`Failed to process repayment for loan ${loan.id}:`, error);
            }
        } else {
             console.log(`Insufficient funds for loan ${loan.id}. Balance: ${borrowerBalance}, Due: ${totalDue}`);
        }
    }
    
    console.log(`Automated repayment process finished. Processed ${processedCount} loans.`);
    return { success: true, message: `Processed ${processedCount} overdue loans.`, processedCount };
}
