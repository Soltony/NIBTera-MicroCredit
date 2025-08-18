
'use server';
/**
 * @fileOverview Implements a loan eligibility check and credit scoring.
 *
 * - checkLoanEligibility - First checks for basic eligibility (age > 20), then calculates a credit score to determine the maximum loan amount.
 * - recalculateScoreAndLoanLimit - Calculates a credit score for a given provider and returns the max loan amount.
 */

import { getConnectedDataSource } from '@/data-source';
import type { Customer } from '@/entities/Customer';
import type { LoanProvider } from '@/entities/LoanProvider';
import type { ScoringParameter } from '@/entities/ScoringParameter';
import { evaluateCondition } from '@/lib/utils';
import type { DataSource } from 'typeorm';

async function calculateScoreForProvider(customerId: number, providerId: number): Promise<{score: number; maxLoanAmount: number}> {
    const dataSource = await getConnectedDataSource();
    const customerRepo = dataSource.getRepository('Customer');
    const providerRepo = dataSource.getRepository('LoanProvider');
    const scoringParamRepo = dataSource.getRepository('ScoringParameter');

    const customer = await customerRepo.findOneBy({ id: customerId });
    if (!customer) {
        throw new Error('Customer not found for score calculation.');
    }
    
    const scoringParameters = await scoringParamRepo.find({
        where: { providerId: providerId },
        relations: ['rules']
    });
    
    const provider = await providerRepo.findOne({
        where: { id: providerId },
        relations: ['products']
    });

    if (!provider || provider.products.length === 0) {
        // If no provider or products, return 0 as no loan is possible.
        return { score: 0, maxLoanAmount: 0 };
    }
    
    // If a provider has no scoring rules, they are not eligible for a loan from them.
    if (scoringParameters.length === 0) {
        return { score: 0, maxLoanAmount: 0 };
    }
    
    let totalWeightedScore = 0;
    const customerLoanHistory = JSON.parse(customer.loanHistory);
    // Combine standard customer fields and dynamic loan history fields into one object for evaluation
    const customerDataForScoring: Record<string, any> = {
        age: customer.age,
        monthlyIncome: customer.monthlyIncome,
        gender: customer.gender,
        educationLevel: customer.educationLevel,
        ...customerLoanHistory
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

    // ** FIX: Calculate max score based only on the current provider's parameters **
    const maxPossibleWeightedScore = scoringParameters.reduce((sum, param) => {
        const maxRuleScore = Math.max(0, ...param.rules.map(r => r.score));
        return sum + (maxRuleScore * (param.weight / 100));
    }, 0);
    
    // Calculate the score as a percentage of the maximum possible score
    const scorePercentage = maxPossibleWeightedScore > 0 ? totalWeightedScore / maxPossibleWeightedScore : 0;
    
    // Find the highest loan amount available from any of the provider's ACTIVE products
    const highestMaxLoanProduct = provider.products
        .filter(p => p.status === 'Active')
        .reduce((max, p) => Math.max(max, p.maxLoan || 0), 0);
        
    // Calculate the loan amount based on the score percentage
    const calculatedLoanAmount = Math.round((highestMaxLoanProduct * scorePercentage) / 100) * 100;
    
    // Ensure the calculated amount doesn't exceed the product's hard limit.
    const suggestedLoanAmountMax = Math.min(calculatedLoanAmount, highestMaxLoanProduct);
        
    return { score: Math.round(totalWeightedScore), maxLoanAmount: suggestedLoanAmountMax };
}


export async function checkLoanEligibility(customerId: number, providerId: number): Promise<{isEligible: boolean; reason: string; score: number, maxLoanAmount: number}> {
  try {
    const dataSource = await getConnectedDataSource();
    const customerRepo = dataSource.getRepository('Customer');

    const customer = await customerRepo.findOneBy({ id: customerId });
    
    if (!customer) {
      return { isEligible: false, reason: 'Customer profile not found.', score: 0, maxLoanAmount: 0 };
    }
    
    // STEP 1: Basic Eligibility Check
    if (customer.age <= 20) {
      return { isEligible: false, reason: 'Customer must be older than 20 to qualify.', score: 0, maxLoanAmount: 0 };
    }
    
    // Check if the provider has any scoring rules defined at all. If not, they are not eligible.
    const scoringParamRepo = dataSource.getRepository('ScoringParameter');
    const scoringParameterCount = await scoringParamRepo.count({ where: { providerId } });
    if (scoringParameterCount === 0) {
        return { isEligible: false, reason: 'This provider has not configured their credit scoring rules.', score: 0, maxLoanAmount: 0 };
    }
    
    // STEP 2: Credit Score Calculation (if eligible)
    const { score, maxLoanAmount } = await calculateScoreForProvider(customerId, providerId);

    if (maxLoanAmount <= 0) {
        return { isEligible: false, reason: 'Your credit score does not meet the minimum requirement for a loan with this provider.', score, maxLoanAmount: 0 };
    }
        
    return { isEligible: true, reason: 'Congratulations! You are eligible for a loan.', score, maxLoanAmount };

  } catch (error) {
    console.error('Error in checkLoanEligibility:', error);
    return { isEligible: false, reason: 'An unexpected server error occurred.', score: 0, maxLoanAmount: 0 };
  }
}


export async function recalculateScoreAndLoanLimit(customerId: number, providerId: number): Promise<{score: number, maxLoanAmount: number}> {
    try {
        const dataSource = await getConnectedDataSource();
        const customer = await dataSource.getRepository('Customer').findOneBy({ id: customerId });
        if (!customer || customer.age <= 20) {
            return { score: 0, maxLoanAmount: 0 };
        }
        return await calculateScoreForProvider(customerId, providerId);
    } catch (error) {
        console.error('Error in recalculateScoreAndLoanLimit:', error);
        return { score: 0, maxLoanAmount: 0 };
    }
}
