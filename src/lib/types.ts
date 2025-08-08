

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

export const parseFee = (feeString: string | undefined): number => {
    if (!feeString) return 0;
    return parseFloat(feeString.replace('%', '')) || 0;
}

// Corrected loan calculation logic based on remaining balance
export const calculateTotalRepayable = (loan: LoanDetails, asOfDate: Date = new Date()): number => {
    const dueDate = startOfDay(new Date(loan.dueDate));
    // A standard 30 day loan is assumed
    const loanStartDate = startOfDay(new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000));
    const finalDate = startOfDay(asOfDate);
    
    let balance = loan.loanAmount;
    const dailyFeeRate = loan.interestRate / 100;
    
    const paymentsByDate = new Map<number, number>();
    if (loan.payments && loan.payments.length > 0) {
        for (const payment of loan.payments) {
            const paymentDate = startOfDay(new Date(payment.date)).getTime();
            paymentsByDate.set(paymentDate, (paymentsByDate.get(paymentDate) || 0) + payment.amount);
        }
    }

    // Determine the number of days for compounding, ensuring it doesn't go past the final date.
    const compoundingEndDate = finalDate > dueDate ? dueDate : finalDate;
    const daysSinceStart = differenceInDays(compoundingEndDate, loanStartDate);

    let compoundedBalance = loan.loanAmount;

    // This loop calculates the compounded interest on the principal
    for (let i = 0; i < daysSinceStart; i++) {
        compoundedBalance *= (1 + dailyFeeRate);
    }
    
    // Start the balance with the compounded amount
    balance = compoundedBalance;
    
    // Add the one-time service fee AFTER interest calculation
    balance += loan.serviceFee;

    // Now, subtract all payments made up to the due date.
    // This is a simplification; a day-by-day ledger is more accurate but complex.
    // For this app's purpose, we assume payments reduce the final calculated balance.
    if (loan.repaidAmount && loan.repaidAmount > 0) {
        balance -= loan.repaidAmount;
    }


    // Apply penalty if overdue. The penalty is simple interest on the outstanding amount for each day overdue.
    if (finalDate > dueDate) {
       const daysOverdue = differenceInDays(finalDate, dueDate);
       if (daysOverdue > 0) {
            const penaltyRate = (loan.penaltyAmount || 0) / 100; // Assuming penalty is a percentage
            const penalty = balance * penaltyRate * daysOverdue; // Simple interest for penalty
            balance += penalty;
       }
    }


    // The total repayable is the final balance, but it shouldn't be less than what's already been paid.
    // However, for calculating what's *due*, it can be less than zero if overpaid.
    // For simplicity, we'll cap it at 0.
    return Math.max(0, balance);
};
