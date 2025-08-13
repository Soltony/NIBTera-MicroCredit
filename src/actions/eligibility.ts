'use server';
/**
 * @fileOverview Implements a loan eligibility check based on customer data.
 *
 * - checkLoanEligibility - Checks user's loan eligibility based on their profile.
 */

import { AppDataSource } from '@/data-source';
import { Customer } from '@/entities/Customer';

export async function checkLoanEligibility(customerId: number): Promise<{isEligible: boolean; reason: string; score: number}> {
  try {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const customerRepo = AppDataSource.getRepository(Customer);

    const customer = await customerRepo.findOneBy({ id: customerId });
    
    if (!customer) {
      return { isEligible: false, reason: 'Customer profile not found.', score: 0 };
    }

    let score = 0;
    // Basic scoring logic
    if (customer.age >= 25 && customer.age <= 55) score += 20;
    if (customer.monthlySalary > 4000) score += 30;
    
    try {
        const loanHistory = JSON.parse(customer.loanHistory);
        if (loanHistory.onTimeRepayments > 3) score += 25;
        if (loanHistory.totalLoans > 0 && loanHistory.onTimeRepayments / loanHistory.totalLoans > 0.8) score += 10;
    } catch (e) {
        console.error("Could not parse loan history", e);
    }

    if (score >= 50) {
      return { isEligible: true, reason: 'Congratulations! You are eligible for a loan.', score };
    } else {
      return { isEligible: false, reason: 'Based on your profile, you are not currently eligible for a loan.', score };
    }
  } catch (error) {
    console.error('Error in checkLoanEligibility:', error);
    return { isEligible: false, reason: 'An unexpected server error occurred.', score: 0 };
  }
}
