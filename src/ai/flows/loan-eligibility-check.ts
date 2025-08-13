
'use server';
/**
 * @fileOverview Implements a loan eligibility check.
 *
 * - checkLoanEligibility - Checks user's loan eligibility and suggests a loan amount range.
 */

import type { CheckLoanEligibilityInput, CheckLoanEligibilityOutput } from '@/lib/types';
import { AppDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import { In } from 'typeorm';

export async function checkLoanEligibility(input: CheckLoanEligibilityInput): Promise<CheckLoanEligibilityOutput> {
  
  const { providerId } = input;

  if (!providerId) {
     return {
      isEligible: false,
      reason: 'A provider must be selected to check eligibility.',
    };
  }
  
  if (!AppDataSource.isInitialized) await AppDataSource.initialize();
  const providerRepo = AppDataSource.getRepository(LoanProvider);

  const provider = await providerRepo.findOne({
    where: { id: Number(providerId) },
    relations: ['products']
  });

  if (!provider) {
    return {
      isEligible: false,
      reason: 'The selected provider could not be found.',
    };
  }

  const activeProducts = provider.products.filter(p => p.status === 'Active');
  if (activeProducts.length === 0) {
     return {
      isEligible: false,
      reason: `This provider (${provider.name}) has no active loan products available.`,
    };
  }

  // Simulate a simple eligibility check. For example, everyone is eligible for up to 50% of the provider's max loan amount across all products.
  const highestMaxLoan = activeProducts.reduce((max, p) => Math.max(max, p.maxLoan || 0), 0);
  const suggestedLoanAmountMax = highestMaxLoan * 2; // Let's give a generous limit for the demo
  const suggestedLoanAmountMin = activeProducts.reduce((min, p) => Math.min(min, p.minLoan || 500), Infinity);

  if (suggestedLoanAmountMax <= 0) {
      return {
          isEligible: false,
          reason: `This provider (${provider.name}) has no active loan products available.`,
      };
  }


  return {
    isEligible: true,
    suggestedLoanAmountMin,
    suggestedLoanAmountMax,
    reason: 'You are eligible for a loan.',
  };
}
