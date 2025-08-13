
'use server';
/**
 * @fileOverview Implements a loan eligibility check and credit scoring.
 *
 * - checkLoanEligibility - First checks for basic eligibility (age > 20), then calculates a credit score to determine the maximum loan amount.
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


export async function checkLoanEligibility(customerId: number, providerId: number): Promise<{isEligible: boolean; reason: string; score: number, maxLoanAmount: number}> {
  try {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const customerRepo = AppDataSource.getRepository(Customer);
    const providerRepo = AppDataSource.getRepository(LoanProvider);
    const scoringParamRepo = AppDataSource.getRepository(ScoringParameter);

    const customer = await customerRepo.findOneBy({ id: customerId });
    
    if (!customer) {
      return { isEligible: false, reason: 'Customer profile not found.', score: 0, maxLoanAmount: 0 };
    }
    
    // STEP 1: Basic Eligibility Check
    if (customer.age <= 20) {
      return { isEligible: false, reason: 'Customer must be older than 20 to qualify.', score: 0, maxLoanAmount: 0 };
    }

    // If eligible, proceed to calculate credit score and max loan amount
    
    // STEP 2: Credit Score Calculation
    const scoringParameters = await scoringParamRepo.find({
        where: { providerId: providerId },
        relations: ['rules']
    });
    
    const provider = await providerRepo.findOne({
        where: { id: providerId },
        relations: ['products']
    });

    if (!provider || provider.products.length === 0) {
        return { isEligible: false, reason: 'Provider or products not found.', score: 0, maxLoanAmount: 0 };
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
        totalScore += maxScoreForParam;
    });

    // STEP 3: Determine Max Loan Amount based on Score
    const maxPossibleScore = scoringParameters.reduce((sum, param) => {
        const maxRuleScore = Math.max(0, ...param.rules.map(r => r.score));
        return sum + maxRuleScore;
    }, 0);
    
    const scorePercentage = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
    
    const highestMaxLoanProduct = provider.products.reduce((max, p) => Math.max(max, p.maxLoan || 0), 0);
    // Scale loan amount based on score. If score is 100%, they get 1.5x the base max loan.
    const scoreMultiplier = 1 + (scorePercentage * 0.5); 
    const suggestedLoanAmountMax = Math.round((highestMaxLoanProduct * scoreMultiplier) / 100) * 100;
        
    return { isEligible: true, reason: 'Congratulations! You are eligible for a loan.', score: totalScore, maxLoanAmount: suggestedLoanAmountMax };

  } catch (error) {
    console.error('Error in checkLoanEligibility:', error);
    return { isEligible: false, reason: 'An unexpected server error occurred.', score: 0, maxLoanAmount: 0 };
  }
}
