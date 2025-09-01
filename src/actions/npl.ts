
'use server';
/**
 * @fileOverview Implements logic to identify and flag Non-Performing Loans (NPL).
 *
 * - updateNplStatus: A service to find loans overdue by a certain threshold and flag the borrower as NPL.
 */

import prisma from '@/lib/prisma';
import { subDays } from 'date-fns';

const NPL_THRESHOLD_DAYS = 60;

export async function updateNplStatus(): Promise<{ success: boolean; message: string; updatedCount: number }> {
    console.log('Starting NPL status update process...');
    
    const nplThresholdDate = subDays(new Date(), NPL_THRESHOLD_DAYS);

    // Find all unpaid loans where the due date has passed the NPL threshold
    const overdueLoans = await prisma.loan.findMany({
        where: {
            repaymentStatus: 'Unpaid',
            disbursedDate: {
                lt: nplThresholdDate,
            },
        },
        select: {
            borrowerId: true,
        },
    });

    if (overdueLoans.length === 0) {
        console.log('No new NPL loans found.');
        return { success: true, message: 'No new NPL loans to process.', updatedCount: 0 };
    }
    
    const borrowerIdsToFlag = [...new Set(overdueLoans.map(loan => loan.borrowerId))];
    
    try {
        const { count } = await prisma.borrower.updateMany({
            where: {
                id: {
                    in: borrowerIdsToFlag,
                },
                // Only update those who are not already flagged
                status: {
                    not: 'NPL',
                },
            },
            data: {
                status: 'NPL',
            },
        });
        
        console.log(`NPL status update process finished. Updated ${count} borrowers.`);
        return { success: true, message: `Successfully updated ${count} borrowers to NPL status.`, updatedCount: count };

    } catch (error) {
        console.error('Failed to update NPL statuses:', error);
        return { success: false, message: 'An error occurred during the NPL update process.', updatedCount: 0 };
    }
}
