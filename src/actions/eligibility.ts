
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
    
    // First, check if age is greater than 20.
    if (customer.age <= 20) {
      return { isEligible: false, reason: 'Customer must be older than 20 to qualify.', score: 0 };
    }
    
    // If age check passes, calculate a simple credit score.
    // For now, we'll assign a base score if they pass the age check.
    let score = 0;
    if (customer.monthlySalary > 4000) score += 30;
    try {
        const loanHistory = JSON.parse(customer.loanHistory);
        if (loanHistory.onTimeRepayments > 3) score += 25;
    } catch (e) {
        // Ignore if loan history is not available or invalid
    }
    score += 25; // Base score for passing age check

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
