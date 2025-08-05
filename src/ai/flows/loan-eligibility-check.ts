'use server';
/**
 * @fileOverview Implements a mock loan eligibility check.
 *
 * - checkLoanEligibility - Checks user's loan eligibility and suggests a loan amount range.
 */

import type { CheckLoanEligibilityInput, CheckLoanEligibilityOutput } from '@/lib/types';

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
