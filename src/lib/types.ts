

import { z } from 'zod';
import { differenceInDays } from 'date-fns';

export interface LoanProvider {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  products: LoanProduct[];
  color?: string;
  colorHex?: string;
}

export interface LoanProduct {
  id: string;
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
  interestRate: number;
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

// Consolidated Loan Calculation Logic
export const calculateTotalRepayable = (loan: LoanDetails, asOfDate: Date = new Date()): number => {
    const principal = loan.loanAmount;
    const serviceFee = loan.serviceFee;
    const dueDate = new Date(loan.dueDate);

    // This is an approximation of the loan's start date
    const loanStartDate = new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000); 

    // The daily interest rate is stored in the interestRate field.
    const dailyFeeRate = loan.interestRate / 100;

    const daysSinceLoan = differenceInDays(asOfDate, loanStartDate);
    const dailyFees = principal * dailyFeeRate * Math.max(0, daysSinceLoan);

    const penalty = asOfDate > dueDate ? loan.penaltyAmount : 0;
    
    return principal + serviceFee + dailyFees + penalty;
};
