'use server';
/**
 * @fileOverview Implements a mock loan eligibility check.
 *
 * - checkLoanEligibility - Checks user's loan eligibility and suggests a loan amount range.
 * - CheckLoanEligibilityInput - The input type for the checkLoanEligibility function.
 * - CheckLoanEligibilityOutput - The return type for the checkLoanEligibility function.
 */

import { z } from 'zod';

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

export async function checkLoanEligibility(input: CheckLoanEligibilityInput): Promise<CheckLoanEligibilityOutput> {
  if (input.creditScore < 600) {
    return {
      isEligible: false,
      reason: 'Your credit score is below the minimum requirement.',
    };
  }
  if (input.annualIncome < 30000) {
    return {
      isEligible: false,
      reason: 'Your annual income is below the minimum requirement.',
    };
  }

  const suggestedLoanAmountMin = input.annualIncome * 0.1;
  const suggestedLoanAmountMax = input.annualIncome * 0.5;

  return {
    isEligible: true,
    suggestedLoanAmountMin,
    suggestedLoanAmountMax,
    reason: 'You are eligible for a loan.',
  };
}
