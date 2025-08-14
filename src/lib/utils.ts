import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInDays, startOfDay } from 'date-fns';
import type { LoanDetails } from './types';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Corrected loan calculation logic
export const calculateTotalRepayable = (loan: LoanDetails, asOfDate: Date = new Date()): number => {
    const loanStartDate = startOfDay(new Date(loan.disbursedDate));
    const finalDate = startOfDay(asOfDate);
    const dueDate = startOfDay(new Date(loan.dueDate));

    const principal = loan.loanAmount;
    const dailyInterestRate = loan.interestRate / 100;
    const penaltyRate = (loan.penaltyAmount || 0) / 100;

    let interest = 0;
    let penalty = 0;

    // 1. Calculate simple daily interest up to the 'asOfDate'
    const daysSinceStart = differenceInDays(finalDate, loanStartDate);
    if (daysSinceStart > 0) {
        interest = principal * dailyInterestRate * daysSinceStart;
    }

    // 2. Calculate simple daily penalty if overdue
    if (finalDate > dueDate) {
        const daysOverdue = differenceInDays(finalDate, dueDate);
        if (daysOverdue > 0) {
            penalty = principal * penaltyRate * daysOverdue;
        }
    }
    
    // 3. The total debt is principal + service fee + accumulated interest + accumulated penalty
    const totalDebt = principal + loan.serviceFee + interest + penalty;

    return totalDebt;
};
