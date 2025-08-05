import { z } from 'zod';

export interface LoanProvider {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  products: LoanProduct[];
}

export interface LoanProduct {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  minLoan?: number;
  maxLoan?: number;
}

export interface LoanDetails {
  providerName: string;
  productName: string;
  loanAmount: number;
  serviceFee: number;
  interestRate: number;
  dueDate: Date;
  penaltyAmount: number;
  repaymentStatus: 'Paid' | 'Unpaid';
}

export const CheckLoanEligibilityInputSchema = z.object({
  creditScore: z.number().describe("The user's credit score."),
  annualIncome: z.number().describe("The user's annual income."),
});
export type CheckLoanEligibilityInput = z.infer<typeof CheckLoanEligibilityInputSchema>;

export const CheckLoanEligibilityOutputSchema = z.object({
  isEligible: z.boolean().describe('Whether the user is eligible for a loan.'),
  suggestedLoanAmountMin: z.number().optional().describe('The minimum suggested loan amount if eligible.'),
  suggestedLoanAmountMax: z.number().optional().describe('The maximum suggested loan amount if eligible.'),
  reason: z.string().describe('The reason for eligibility or ineligibility.'),
});
export type CheckLoanEligibilityOutput = z.infer<typeof CheckLoanEligibilityOutputSchema>;
