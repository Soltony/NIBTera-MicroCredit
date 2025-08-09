

import { z } from 'zod';
import { differenceInDays, startOfDay, subDays } from 'date-fns';

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
  status: 'Active' | 'Disabled';
}

export interface Payment {
  amount: number;
  date: Date;
  outstandingBalanceBeforePayment?: number;
}

export interface LoanDetails {
  id: string; // Added for unique identification
  providerName: string;
  productName: string;
  loanAmount: number;
  serviceFee: number;
  interestRate: number; // Represents the daily fee percentage
  disbursedDate: Date;
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
    providerId?: string;
    providerName?: string;
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

export interface TransactionProduct {
    id: string;
    name: string;
    weight: number;
}

export const parseFee = (feeString: string | undefined): number => {
    if (!feeString) return 0;
    return parseFloat(feeString.replace('%', '')) || 0;
}

// Corrected loan calculation logic based on compounding interest.
export const calculateTotalRepayable = (loan: LoanDetails, asOfDate: Date = new Date()): number => {
    let balance = loan.loanAmount;
    
    // 1. Calculate compounded interest on the principal
    const loanStartDate = startOfDay(new Date(loan.disbursedDate));
    const finalDate = startOfDay(asOfDate);
    const daysSinceStart = differenceInDays(finalDate, loanStartDate);

    if (daysSinceStart > 0) {
      balance = loan.loanAmount * Math.pow(1 + (loan.interestRate / 100), daysSinceStart);
    }

    // 2. Add the one-time service fee
    balance += loan.serviceFee;

    // 3. Apply penalty if overdue
    const dueDate = startOfDay(new Date(loan.dueDate));
    if (finalDate > dueDate) {
       const daysOverdue = differenceInDays(finalDate, dueDate);
       if (daysOverdue > 0) {
            const penaltyRate = (loan.penaltyAmount || 0) / 100;
            const penalty = (loan.loanAmount) * penaltyRate * daysOverdue;
            balance += penalty;
       }
    }

    return Math.max(0, balance);
};
