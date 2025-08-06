
'use server';
/**
 * @fileOverview Implements a mock loan eligibility check.
 *
 * - checkLoanEligibility - Checks user's loan eligibility and suggests a loan amount range.
 */

import type { CheckLoanEligibilityInput, CheckLoanEligibilityOutput } from '@/lib/types';

// Mock credit scores for different providers for demonstration
const mockProviderCreditData: Record<string, { creditScore: number; annualIncome: number }> = {
    'provider-1': { creditScore: 720, annualIncome: 75000 }, // Capital Bank
    'provider-2': { creditScore: 680, annualIncome: 55000 }, // Providus Financial
    'provider-3': { creditScore: 650, annualIncome: 45000 }, // NIb Bank
};


export async function checkLoanEligibility(input: CheckLoanEligibilityInput): Promise<CheckLoanEligibilityOutput> {
  
  const { providerId } = input;
  const creditData = mockProviderCreditData[providerId] ?? { creditScore: 600, annualIncome: 30000 };
  
  const { creditScore, annualIncome } = creditData;

  if (creditScore < 600) {
    return {
      isEligible: false,
      reason: 'Your credit score is below the minimum requirement.',
    };
  }
  if (annualIncome < 30000) {
    return {
      isEligible: false,
      reason: 'Your annual income is below the minimum requirement.',
    };
  }

  const suggestedLoanAmountMin = annualIncome * 0.1;
  const suggestedLoanAmountMax = annualIncome * 0.5;

  return {
    isEligible: true,
    suggestedLoanAmountMin,
    suggestedLoanAmountMax,
    reason: 'You are eligible for a loan.',
  };
}
