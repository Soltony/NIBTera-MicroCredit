
import { z } from 'zod';

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
