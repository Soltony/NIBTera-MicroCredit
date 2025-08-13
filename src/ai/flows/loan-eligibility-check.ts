
'use server';
/**
 * @fileOverview This file is DEPRECATED and not used for eligibility checks.
 * The active eligibility logic is in /src/actions/eligibility.ts
 */

export async function checkLoanEligibility(customerId: number): Promise<{isEligible: boolean; reason: string; score: number}> {
  console.warn("DEPRECATED: checkLoanEligibility from /src/ai/flows is being called. Use the function from /src/actions/eligibility.ts instead.");
  return { isEligible: false, reason: 'This eligibility check is outdated.', score: 0 };
}
