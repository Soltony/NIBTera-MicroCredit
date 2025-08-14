

import { z } from 'zod';
import { differenceInDays, startOfDay, subDays } from 'date-fns';
import type { LucideIcon } from 'lucide-react';

export interface LoanProvider {
  id: string;
  name: string;
  icon: string;
  products: LoanProduct[];
  color?: string;
  colorHex?: string;
  displayOrder: number;
}

export interface LoanProduct {
  id:string;
  name: string;
  description: string;
  icon: string;
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
  // Add other user data fields here as needed for a real check
  // e.g., age: z.number(), monthlyIncome: z.number(), etc.
});
export type CheckLoanEligibilityInput = z.infer<typeof CheckLoanEligibilityInputSchema>;

export const CheckLoanEligibilityOutputSchema = z.object({
  isEligible: z.boolean().describe('Whether the user is eligible for a loan.'),
  suggestedLoanAmountMin: z.number().optional().describe('The minimum suggested loan amount if eligible.'),
  suggestedLoanAmountMax: z.number().optional().describe('The maximum suggested loan amount if eligible.'),
  reason: z.string().describe('The reason for eligibility or ineligibility.'),
});
export type CheckLoanEligibilityOutput = z.infer<typeof CheckLoanEligibilityOutputSchema>;


export type UserRole = 'Super Admin' | 'Admin' | 'Loan Manager' | 'Auditor' | 'Loan Provider';
export type UserStatus = 'Active' | 'Inactive';

export interface User {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    role: UserRole;
    status: UserStatus;
    providerId?: string | null;
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
}

export const parseFee = (feeString: string | undefined): number => {
    if (!feeString) return 0;
    return parseFloat(feeString.replace('%', '')) || 0;
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

// Types for Scoring Engine
export interface Rule {
  id: string;
  field: string;
  condition: string;
  value: string;
  score: number;
}

export interface ScoringParameter {
  id: string;
  providerId: string;
  name: string;
  weight: number;
  rules: Rule[];
}

export const evaluateCondition = (inputValue: string | number | undefined, condition: string, ruleValue: string): boolean => {
    if (inputValue === undefined) return false;

    const numericInputValue = typeof inputValue === 'string' ? parseFloat(inputValue) : inputValue;
    const isNumericComparison = !isNaN(numericInputValue) && !isNaN(parseFloat(ruleValue.split('-')[0]));
    
    if (isNumericComparison) {
        if (condition === 'between') {
            const [min, max] = ruleValue.split('-').map(parseFloat);
            if (isNaN(min) || isNaN(max)) return false;
            return numericInputValue >= min && numericInputValue <= max;
        }

        const numericRuleValue = parseFloat(ruleValue);
        if (isNaN(numericRuleValue)) return false;

        switch (condition) {
            case '>': return numericInputValue > numericRuleValue;
            case '<': return numericInputValue < numericRuleValue;
            case '>=': return numericInputValue >= numericRuleValue;
            case '<=': return numericInputValue <= numericRuleValue;
            case '==': return numericInputValue == numericRuleValue;
            case '!=': return numericInputValue != numericRuleValue;
            default: return false;
        }
    } else {
        // Fallback to string comparison for non-numeric values
         switch (condition) {
            case '==': return String(inputValue).toLowerCase() == ruleValue.toLowerCase();
            case '!=': return String(inputValue).toLowerCase() != ruleValue.toLowerCase();
            default: return false; // Other operators are not supported for strings
        }
    }
};

// In-memory store for custom icons to avoid localStorage quota issues.
// This will persist for the duration of the user session.
let customIconStore: Map<string, string> | null = null;

function getIconStore(): Map<string, string> {
    if (typeof window === 'undefined') {
        // Return a dummy map for server-side rendering
        return new Map<string, string>();
    }
    if (!customIconStore) {
        customIconStore = new Map<string, string>();
    }
    return customIconStore;
}

export function saveCustomIcon(key: string, dataUri: string) {
    if (typeof window !== 'undefined') {
        const store = getIconStore();
        store.set(key, dataUri);
    }
}

export function getCustomIcon(key: string): string | null {
    if (typeof window !== 'undefined') {
        const store = getIconStore();
        return store.get(key) || null;
    }
    return null;
}
