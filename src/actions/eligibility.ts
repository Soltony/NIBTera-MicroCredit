
'use server';
/**
 * @fileOverview Implements a loan eligibility check and credit scoring.
 *
 * - checkLoanEligibility - First checks for basic eligibility (age > 20), then calculates a credit score to determine the maximum loan amount.
 * - recalculateScoreAndLoanLimit - Calculates a credit score for a given provider and returns the max loan amount.
 */

import { getConnectedDataSource } from '@/data-source';
import type { Customer } from '@/entities/Customer';
import { evaluateCondition } from '@/lib/utils';
import type { DataSource, In } from 'typeorm';
import { MoreThanOrEqual, LessThanOrEqual } from 'typeorm';

async function calculateScoreForProvider(customerId: number, providerId: number, productId: number): Promise<{score: number; maxLoanAmount: number}> {
    const dataSource = await getConnectedDataSource();
    const customerRepo = dataSource.getRepository('Customer');
    const scoringParamRepo = dataSource.getRepository('ScoringParameter');
    const loanTierRepo = dataSource.getRepository('LoanAmountTier');

    const customer = await customerRepo.findOneBy({ id: customerId });
    if (!customer) {
        throw new Error('Customer not found for score calculation.');
    }
    
    const scoringParameters = await scoringParamRepo.find({
        where: { providerId: providerId },
        relations: ['rules']
    });
    
    // If a provider has no scoring rules, they are not eligible for a loan from them.
    if (scoringParameters.length === 0) {
        return { score: 0, maxLoanAmount: 0 };
    }
    
    let totalWeightedScore = 0;
    const customerLoanHistory = JSON.parse(customer.loanHistory);
    // Combine standard customer fields and dynamic loan history fields into one object for evaluation
    const customerDataForScoring: Record<string, any> = {
        age: Number(customer.age) || 0,
        monthlyIncome: Number(customer.monthlyIncome) || 0,
        gender: customer.gender,
        educationLevel: customer.educationLevel,
        // Ensure loan history fields are numeric for proper evaluation
        totalLoans: Number(customerLoanHistory.totalLoans) || 0,
        onTimeRepayments: Number(customerLoanHistory.onTimeRepayments) || 0,
    };

    scoringParameters.forEach(param => {
        let maxScoreForParam = 0;
        param.rules.forEach(rule => {
            const inputValue = customerDataForScoring[rule.field];
            if (evaluateCondition(inputValue, rule.condition, rule.value)) {
                if (rule.score > maxScoreForParam) {
                    maxScoreForParam = rule.score;
                }
            }
        });
        totalWeightedScore += maxScoreForParam * (param.weight / 100);
    });

    const finalScore = Math.round(totalWeightedScore);

    // Find the loan amount from the tiers based on the calculated score for the specific product
    const applicableTier = await loanTierRepo.findOne({
        where: {
            productId: productId,
            fromScore: LessThanOrEqual(finalScore),
            toScore: MoreThanOrEqual(finalScore),
        }
    });
        
    return { score: finalScore, maxLoanAmount: applicableTier?.loanAmount || 0 };
}


export async function checkLoanEligibility(customerId: number, providerId: number, productId: number): Promise<{isEligible: boolean; reason: string; score: number, maxLoanAmount: number}> {
  try {
    const dataSource = await getConnectedDataSource();
    const customerRepo = dataSource.getRepository('Customer');
    const loanRepo = dataSource.getRepository('LoanDetails');
    const providerRepo = dataSource.getRepository('LoanProvider');

    const customer = await customerRepo.findOneBy({ id: customerId });
    if (!customer) {
      return { isEligible: false, reason: 'Customer profile not found.', score: 0, maxLoanAmount: 0 };
    }
    
    // STEP 1: Basic Eligibility Check
    if (customer.age <= 20) {
      return { isEligible: false, reason: 'Customer must be older than 20 to qualify.', score: 0, maxLoanAmount: 0 };
    }

    const provider = await providerRepo.findOneBy({ id: providerId });
    if (!provider) {
        return { isEligible: false, reason: 'Loan provider not found.', score: 0, maxLoanAmount: 0 };
    }

    // STEP 2: Check for existing active loans based on provider rules
    const allActiveLoans = await loanRepo.find({ where: { repaymentStatus: 'Unpaid' } });
    const activeLoansWithThisProvider = allActiveLoans.filter(l => l.providerId === providerId);
    const activeLoansWithOtherProviders = allActiveLoans.filter(l => l.providerId !== providerId);

    if (activeLoansWithThisProvider.length > 0 && !provider.allowMultipleProviderLoans) {
        return { isEligible: false, reason: 'This provider does not allow multiple active loans. Please repay your existing loan first.', score: 0, maxLoanAmount: 0 };
    }

    if (activeLoansWithOtherProviders.length > 0 && !provider.allowCrossProviderLoans) {
        return { isEligible: false, reason: 'This provider does not allow loans if you have active loans with other providers.', score: 0, maxLoanAmount: 0 };
    }

    // STEP 3: Check if the provider has any scoring rules defined at all.
    const scoringParamRepo = dataSource.getRepository('ScoringParameter');
    const scoringParameterCount = await scoringParamRepo.count({ where: { providerId } });
    if (scoringParameterCount === 0) {
        return { isEligible: false, reason: 'This provider has not configured their credit scoring rules.', score: 0, maxLoanAmount: 0 };
    }
    
    // STEP 4: Credit Score Calculation
    const { score, maxLoanAmount } = await calculateScoreForProvider(customerId, providerId, productId);

    if (maxLoanAmount <= 0) {
        return { isEligible: false, reason: 'Your credit score does not meet the minimum requirement for a loan with this provider.', score, maxLoanAmount: 0 };
    }
        
    return { isEligible: true, reason: 'Congratulations! You are eligible for a loan.', score, maxLoanAmount };

  } catch (error) {
    console.error('Error in checkLoanEligibility:', error);
    return { isEligible: false, reason: 'An unexpected server error occurred.', score: 0, maxLoanAmount: 0 };
  }
}


export async function recalculateScoreAndLoanLimit(customerId: number, providerId: number, productId: number): Promise<{score: number, maxLoanAmount: number}> {
    try {
        const dataSource = await getConnectedDataSource();
        const customer = await dataSource.getRepository('Customer').findOneBy({ id: customerId });
        if (!customer || customer.age <= 20) {
            return { score: 0, maxLoanAmount: 0 };
        }
        return await calculateScoreForProvider(customerId, providerId, productId);
    } catch (error) {
        console.error('Error in recalculateScoreAndLoanLimit:', error);
        return { score: 0, maxLoanAmount: 0 };
    }
}
