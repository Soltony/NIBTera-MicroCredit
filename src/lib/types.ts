
import { z } from 'zod';
import { startOfDay } from 'date-fns';
import type { LucideIcon } from 'lucide-react';


export interface FeeRule {
    type: 'fixed' | 'percentage';
    value: number | '';
}

export interface PenaltyRule {
    id: string;
    fromDay: number | '';
    toDay: number | Infinity | '' | null;
    type: 'fixed' | 'percentageOfPrincipal';
    value: number | '';
}

export interface DataColumn {
    id: string;
    name: string;
    type: 'string' | 'number' | 'date';
}

export interface DataProvisioningConfig {
    id: string;
    providerId: string;
    name: string;
    columns: DataColumn[];
}

export interface LoanAmountTier {
    id: string;
    productId: string;
    fromScore: number;
    toScore: number;
    loanAmount: number;
}


export interface LoanProvider {
  id: string;
  name: string;
  icon: string;
  products: LoanProduct[];
  dataProvisioningConfigs?: DataProvisioningConfig[];
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
  serviceFee: FeeRule;
  dailyFee: FeeRule;
  penaltyRules: PenaltyRule[];
  loanAmountTiers?: LoanAmountTier[];
  availableLimit?: number;
  status: 'Active' | 'Disabled';
  serviceFeeEnabled?: boolean;
  dailyFeeEnabled?: boolean;
  penaltyRulesEnabled?: boolean;
  dataProvisioningEnabled?: boolean;
  dataProvisioningConfigId?: string | null;
  dataProvisioningConfig?: DataProvisioningConfig;
}

export interface Payment {
  id: string;
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
  disbursedDate: Date;
  dueDate: Date;
  repaymentStatus: 'Paid' | 'Unpaid';
  repaidAmount?: number;
  payments: Payment[];
  penaltyAmount: number;
  // For calculation purposes, not stored in DB
  product?: LoanProduct;
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

// Type for Scoring Engine
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

// Type for Legacy Scoring Config page
export type GenderImpact = number;

export interface ScoringParameters {
  productIds: string[];
  weights: {
    age: { enabled: boolean; value: number };
    transactionHistoryTotal: { enabled: boolean; value: number };
    transactionHistoryByProduct: { enabled: boolean; values: Record<string, number> };
    loanHistoryCount: { enabled: boolean; value: number };
    onTimeRepayments: { enabled: boolean; value: number };
    salary: { enabled: boolean; value: number };
  };
  genderImpact: {
    enabled: boolean;
    male: GenderImpact;
    female: GenderImpact;
  };
  occupationRisk: {
    enabled: boolean;
    values: Record<string, 'Low' | 'Medium' | 'High'>;
  };
}
