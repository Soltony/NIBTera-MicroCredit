
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
            const data = JSON.parse(provisionedData.data);
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
            product: true,
            provider: {
                include: {
                    ledgerAccounts: true,
                }
            },
        },
    });

    if (overdueLoans.length === 0) {
        console.log('No overdue loans found.');
        return { success: true, message: 'No overdue loans to process.', processedCount: 0 };
    }

    let processedCount = 0;

    for (const loan of overdueLoans) {
        // 2. Calculate the total amount due for each loan
        const totalDue = calculateTotalRepayable(loan as any, loan.product, today) - (loan.repaidAmount || 0);

        if (totalDue <= 0) {
            continue; // Skip if already paid off
        }

        // 3. Check customer's available balance
        const borrowerBalance = await getBorrowerBalance(loan.borrowerId);
        
        // 4. Perform deduction if funds are sufficient
        if (borrowerBalance >= totalDue) {
            try {
                await prisma.$transaction(async (tx) => {
                    // Create payment record
                    await tx.payment.create({
                        data: {
                            loanId: loan.id,
                            amount: totalDue,
                            date: today,
                            outstandingBalanceBeforePayment: totalDue,
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


                    // 5. Update financial ledgers
                    const principalReceivable = loan.provider.ledgerAccounts.find(a => a.category === 'Principal' && a.type === 'Receivable');
                    const principalReceived = loan.provider.ledgerAccounts.find(a => a.category === 'Principal' && a.type === 'Received');
                    
                    if (principalReceivable && principalReceived) {
                        await tx.ledgerAccount.update({
                            where: { id: principalReceivable.id },
                            data: { balance: { decrement: loan.loanAmount } }
                        });
                         await tx.ledgerAccount.update({
                            where: { id: principalReceived.id },
                            data: { balance: { increment: loan.loanAmount } }
                        });
                    }
                    // Similar logic for Interest and Penalty would go here
                });
                
                processedCount++;
                console.log(`Successfully processed repayment for loan ${loan.id}.`);

            } catch (error) {
                console.error(`Failed to process repayment for loan ${loan.id}:`, error);
                // Continue to the next loan even if one fails
            }
        } else {
             console.log(`Insufficient funds for loan ${loan.id}. Balance: ${borrowerBalance}, Due: ${totalDue}`);
        }
    }
    
    console.log(`Automated repayment process finished. Processed ${processedCount} loans.`);
    return { success: true, message: `Processed ${processedCount} overdue loans.`, processedCount };
}
