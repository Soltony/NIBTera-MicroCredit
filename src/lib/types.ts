

import { z } from 'zod';
import { startOfDay } from 'date-fns';
import type { LucideIcon } from 'lucide-react';


export interface FeeRule {
    type: 'fixed' | 'percentage';
    value: number | '';
}

export interface DailyFeeRule extends FeeRule {
    calculationBase?: 'principal' | 'compound';
}

export interface PenaltyRule {
    id: string;
    fromDay: number | '';
    toDay: number | Infinity | '' | null;
    type: 'fixed' | 'percentageOfPrincipal' | 'percentageOfCompound';
    value: number | '';
    frequency: 'daily' | 'one-time';
}

export interface DataColumn {
    id: string;
    name: string;
    type: 'string' | 'number' | 'date';
    isIdentifier: boolean;
    options?: string[];
}

export interface DataProvisioningUpload {
    id: string;
    configId: string;
    fileName: string;
    rowCount: number;
    uploadedAt: string;
    uploadedBy: string;
}

export interface DataProvisioningConfig {
    id:string;
    providerId: string;
    name: string;
    columns: DataColumn[];
    uploads?: DataProvisioningUpload[];
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
  accountNumber: string | null;
  startingCapital: number;
  initialBalance: number;
  allowCrossProviderLoans: boolean;
  ledgerAccounts?: LedgerAccount[];
  termsAndConditions?: TermsAndConditions[];
}

export interface LoanProduct {
  id:string;
  providerId: string;
  name: string;
  description: string;
  icon: string;
  minLoan?: number;
  maxLoan?: number;
  duration?: number;
  serviceFee: FeeRule;
  dailyFee: DailyFeeRule;
  penaltyRules: PenaltyRule[];
  loanAmountTiers?: LoanAmountTier[];
  availableLimit?: number;
  status: 'Active' | 'Disabled';
  allowConcurrentLoans?: boolean;
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
  borrowerId: string;
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
  product: LoanProduct;
  provider?: LoanProvider;
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
  parameterId: string;
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

export interface ScoringHistoryItem {
    id: string;
    savedAt: Date;
    parameters: string; // Stored as JSON string
    appliedProducts: { product: { name: string } }[];
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

export interface LedgerAccount {
    id: string;
    providerId: string;
    name: string;
    type: 'Receivable' | 'Received' | 'Income';
    category: 'Principal' | 'Interest' | 'Penalty' | 'ServiceFee';
    balance: number;
}


interface LedgerData {
    principal: number;
    interest: number;
    serviceFee: number;
    penalty: number;
}

interface IncomeData {
    interest: number;
    serviceFee: number;
    penalty: number;
}


export interface DashboardData {
    totalLoans: number;
    totalDisbursed: number;
    repaymentRate: number;
    atRiskLoans: number;
    totalUsers: number;
    loanDisbursementData: { name: string; amount: number }[];
    loanStatusData: { name: string; value: number }[];
    recentActivity: { id: string; customer: string; product: string; status: string; amount: number }[];
    productOverview: { name: string; provider: string; active: number; defaulted: number; total: number, defaultRate: number }[];
    initialFund: number;
    providerFund: number;
    receivables: LedgerData;
    collections: LedgerData;
    income: IncomeData;
}


export interface TermsAndConditions {
    id: string;
    providerId: string;
    content: string;
    version: number;
    isActive: boolean;
    publishedAt: Date;
}

export interface BorrowerAgreement {
    id: string;
    borrowerId: string;
    termsId: string;
    acceptedAt: Date;
}
