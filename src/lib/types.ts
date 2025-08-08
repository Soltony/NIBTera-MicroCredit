

import { z } from 'zod';
import { differenceInDays, startOfDay } from 'date-fns';

export interface LoanProvider {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  products: LoanProduct[];
  color?: string;
  colorHex?: string;
}

export interface LoanProduct {
  id:string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  minLoan?: number;
  maxLoan?: number;
  serviceFee?: string;
  dailyFee?: string;
  penaltyFee?: string;
  availableLimit?: number;
}

export interface Payment {
  amount: number;
  date: Date;
}

export interface LoanDetails {
  id: string; // Added for unique identification
  providerName: string;
  productName: string;
  loanAmount: number;
  serviceFee: number;
  interestRate: number; // Represents the daily fee percentage
  dueDate: Date;
  penaltyAmount: number;
  repaymentStatus: 'Paid' | 'Unpaid';
  repaidAmount?: number;
  payments: Payment[];
}

export const CheckLoanEligibilityInputSchema = z.object({
  providerId: z.string().describe("The ID of the loan provider."),
});
export type CheckLoanEligibilityInput = z.infer<typeof CheckLoanEligibilityInputSchema>;

export const CheckLoanEligibilityOutputSchema = z.object({
  isEligible: z.boolean().describe('Whether the user is eligible for a loan.'),
  suggestedLoanAmountMin: z.number().optional().describe('The minimum suggested loan amount if eligible.'),
  suggestedLoanAmountMax: z.number().optional().describe('The maximum suggested loan amount if eligible.'),
  reason: z.string().describe('The reason for eligibility or ineligibility.'),
});
export type CheckLoanEligibilityOutput = z.infer<typeof CheckLoanEligibilityOutputSchema>;


export type UserRole = 'Admin' | 'Loan Provider';
export type UserStatus = 'Active' | 'Inactive';

export interface User {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    role: UserRole;
    status: UserStatus;
}

export type Permissions = {
    [key: string]: {
        create: boolean;
        read: boolean;
        update: boolean;
        delete: boolean;
    };
};

export interface Role {
    id: string;
    name: string;
    permissions: Permissions;
}


// Corrected loan calculation logic based on remaining balance
export const calculateTotalRepayable = (loan: LoanDetails, asOfDate: Date = new Date()): number => {
    const dueDate = startOfDay(new Date(loan.dueDate));
    // A standard 30 day loan is assumed
    const loanStartDate = startOfDay(new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000));
    const finalDate = startOfDay(asOfDate);
    
    // Initial balance is principal + one-time service fee
    let balance = loan.loanAmount;

    const dailyFeeRate = loan.interestRate / 100;
    
    // Create a map of payments for quick lookup
    const paymentsByDate = new Map<number, number>();
    if (loan.payments && loan.payments.length > 0) {
        for (const payment of loan.payments) {
            const paymentDate = startOfDay(new Date(payment.date)).getTime();
            paymentsByDate.set(paymentDate, (paymentsByDate.get(paymentDate) || 0) + payment.amount);
        }
    }

    // Iterate day-by-day from loan start to asOfDate
    for (
        let d = new Date(loanStartDate.getTime());
        d < finalDate && d < dueDate; // Only accrue daily fees up to the due date for this calculation
        d.setDate(d.getDate() + 1)
    ) {
        const dayTime = d.getTime();

        // Apply payments made on this day before calculating interest
        if (paymentsByDate.has(dayTime)) {
            balance -= paymentsByDate.get(dayTime)!;
        }

        // Add daily fee (compounded) if balance is positive
        if (balance > 0) {
           balance *= (1 + dailyFeeRate);
        }
    }
     // Apply payments on the final day
    const finalDayTime = finalDate.getTime();
    if (paymentsByDate.has(finalDayTime)) {
        balance -= paymentsByDate.get(finalDayTime)!;
    }
    
    // Add service fee at the end, before penalty
    balance += loan.serviceFee;

    // Apply penalty if overdue and not yet fully paid
    if (finalDate > dueDate && balance > (loan.repaidAmount || 0)) {
       const daysOverdue = differenceInDays(finalDate, dueDate);
       // Simple interest for penalty
       const penalty = loan.penaltyAmount * daysOverdue;
       balance += penalty;
    }

    // Ensure balance doesn't go below zero
    return Math.max(0, balance);
};
