
'use server';
/**
 * @fileOverview Implements a loan eligibility check and credit scoring.
 *
 * - checkLoanEligibility - First checks for basic eligibility (age > 20), then calculates a credit score to determine the maximum loan amount.
 * - recalculateScoreAndLoanLimit - Calculates a credit score for a given provider and returns the max loan amount.
 */

import { AppDataSource } from '@/data-source';
import { Customer } from '@/entities/Customer';
import { LoanProvider } from '@/entities/LoanProvider';
import { ScoringParameter } from '@/entities/ScoringParameter';

const evaluateCondition = (inputValue: string | number | undefined, condition: string, ruleValue: string): boolean => {
    if (inputValue === undefined) return false;

    const numericInputValue = typeof inputValue === 'string' ? parseFloat(inputValue) : inputValue;
    const isNumericComparison = !isNaN(numericInputValue);
    
    if (isNumericComparison) {
        if (condition === 'between') {
            const [min, max] = ruleValue.split('-').map(parseFloat);
            if (isNaN(min) || isNaN(max)) return false;
            return numericInputValue >= min && numericInputValue <= max;
        }

        const numericRuleValue = parseFloat(ruleValue);
        if (isNaN(numericRuleValue)) return false;

        switch (condition) {
            case '>': return numericInputValue > numericRuleValue;
            case '<': return numericInputValue < numericRuleValue;
            case '>=': return numericInputValue >= numericRuleValue;
            case '<=': return numericInputValue <= numericRuleValue;
            case '==': return numericInputValue == numericRuleValue;
            case '!=': return numericInputValue != numericRuleValue;
            default: return false;
        }
    } else {
        // Fallback to string comparison for non-numeric values
         switch (condition) {
            case '==': return inputValue == ruleValue;
            case '!=': return inputValue != ruleValue;
            default: return false; // Other operators are not supported for strings
        }
    }
};

async function calculateScoreForProvider(customerId: number, providerId: number): Promise<{score: number; maxLoanAmount: number}> {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const customerRepo = AppDataSource.getRepository(Customer);
    const providerRepo = AppDataSource.getRepository(LoanProvider);
    const scoringParamRepo = AppDataSource.getRepository(ScoringParameter);

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
        throw new Error('Provider or products not found for score calculation.');
    }
    
    let totalScore = 0;
    const customerLoanHistory = JSON.parse(customer.loanHistory);
    const customerDataForScoring = {
        age: customer.age,
        monthlyIncome: customer.monthlyIncome,
        ...customerLoanHistory
    };

    scoringParameters.forEach(param => {
        let maxScoreForParam = 0;
        param.rules.forEach(rule => {
            const inputValue = customerDataForScoring[rule.field as keyof typeof customerDataForScoring];
            if (evaluateCondition(inputValue, rule.condition, rule.value)) {
                if (rule.score > maxScoreForParam) {
                    maxScoreForParam = rule.score;
                }
            }
        });
        totalScore += maxScoreForParam * (param.weight / 100);
    });

    const maxPossibleScore = scoringParameters.reduce((sum, param) => {
        const maxRuleScore = Math.max(0, ...param.rules.map(r => r.score));
        return sum + (maxRuleScore * (param.weight / 100));
    }, 0);
    
    const scorePercentage = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
    
    const highestMaxLoanProduct = provider.products
        .filter(p => p.status === 'Active')
        .reduce((max, p) => Math.max(max, p.maxLoan || 0), 0);
        
    // Calculate loan amount based on score percentage, but don't just give the max.
    // Let's say a perfect score gets 100% of the max loan, and 0 score gets 20% (as a base).
    const baseLoanPercentage = 0.20; // Everyone eligible gets at least 20% of the max loan.
    const scoreBasedPercentage = (1 - baseLoanPercentage) * scorePercentage;
    const finalLoanPercentage = baseLoanPercentage + scoreBasedPercentage;

    const calculatedLoanAmount = Math.round((highestMaxLoanProduct * finalLoanPercentage) / 100) * 100;
    
    // Ensure the calculated amount doesn't exceed the product's hard limit.
    const suggestedLoanAmountMax = Math.min(calculatedLoanAmount, highestMaxLoanProduct);
        
    return { score: Math.round(totalScore), maxLoanAmount: suggestedLoanAmountMax };
}


export async function checkLoanEligibility(customerId: number, providerId: number): Promise<{isEligible: boolean; reason: string; score: number, maxLoanAmount: number}> {
  try {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const customerRepo = AppDataSource.getRepository(Customer);

    const customer = await customerRepo.findOneBy({ id: customerId });
    
    if (!customer) {
      return { isEligible: false, reason: 'Customer profile not found.', score: 0, maxLoanAmount: 0 };
    }
    
    // STEP 1: Basic Eligibility Check
    if (customer.age <= 20) {
      return { isEligible: false, reason: 'Customer must be older than 20 to qualify.', score: 0, maxLoanAmount: 0 };
    }
    
    // STEP 2: Credit Score Calculation (if eligible)
    const { score, maxLoanAmount } = await calculateScoreForProvider(customerId, providerId);
        
    return { isEligible: true, reason: 'Congratulations! You are eligible for a loan.', score, maxLoanAmount };

  } catch (error) {
    console.error('Error in checkLoanEligibility:', error);
    return { isEligible: false, reason: 'An unexpected server error occurred.', score: 0, maxLoanAmount: 0 };
  }
}


export async function recalculateScoreAndLoanLimit(customerId: number, providerId: number): Promise<{score: number, maxLoanAmount: number}> {
    try {
        return await calculateScoreForProvider(customerId, providerId);
    } catch (error) {
        console.error('Error in recalculateScoreAndLoanLimit:', error);
        return { score: 0, maxLoanAmount: 0 };
    }
}
