
'use server';
/**
 * @fileOverview Implements a loan eligibility check and credit scoring.
 *
 * - checkLoanEligibility - First checks for basic eligibility (age > 20), then calculates a credit score to determine the maximum loan amount.
 * - recalculateScoreAndLoanLimit - Calculates a credit score for a given provider and returns the max loan amount.
 */

import prisma from '@/lib/prisma';
import type { Customer } from '@prisma/client';
import { evaluateCondition } from '@/lib/utils';
import type { ScoringParameter as ScoringParameterType } from '@/lib/types';


async function getCustomerDataForScoring(customerId: string): Promise<Record<string, any>> {
    const provisionedDataEntries = await prisma.provisionedData.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
    });

    const latestProvisionedData: Record<string, any> = {};
    for (const entry of provisionedDataEntries) {
        const data = JSON.parse(entry.data);
        // Newest data gets precedence, but we merge to get a full profile
        Object.assign(latestProvisionedData, { id: customerId, ...data });
    }
    return latestProvisionedData;
}


async function calculateScoreForProvider(customerId: string, providerId: string, productId: string): Promise<{score: number; maxLoanAmount: number}> {
    
    const customerDataForScoring = await getCustomerDataForScoring(customerId);
    
    const parameters: ScoringParameterType[] = await prisma.scoringParameter.findMany({
        where: { providerId },
        include: {
            rules: true,
        },
    });
    
    if (parameters.length === 0) {
        return { score: 0, maxLoanAmount: 0 };
    }
    
    let totalScore = 0;

    parameters.forEach(param => {
        let maxScoreForParam = 0;
        const relevantRules = param.rules || [];
        
        relevantRules.forEach(rule => {
            const inputValue = customerDataForScoring[rule.field];
            if (evaluateCondition(inputValue, rule.condition, rule.value)) {
                if (rule.score > maxScoreForParam) {
                    maxScoreForParam = rule.score;
                }
            }
        });
        
        const scoreForThisParam = Math.min(maxScoreForParam, param.weight);
        totalScore += scoreForThisParam;
    });

    const finalScore = Math.round(totalScore);

    const applicableTier = await prisma.loanAmountTier.findFirst({
        where: {
            productId: productId,
            fromScore: { lte: finalScore },
            toScore: { gte: finalScore },
        }
    });
        
    return { score: finalScore, maxLoanAmount: applicableTier?.loanAmount || 0 };
}


export async function checkLoanEligibility(customerId: string, providerId: string, productId: string): Promise<{isEligible: boolean; reason: string; score: number, maxLoanAmount: number}> {
  try {
    const customerData = await getCustomerDataForScoring(customerId);

    if (!customerData || Object.keys(customerData).length <= 1) { // has more than just id
      return { isEligible: false, reason: 'Customer profile not found.', score: 0, maxLoanAmount: 0 };
    }
    
    // Assuming 'age' is a field in the provisioned data
    const age = Number(customerData.age);
    if (!isNaN(age) && age <= 20) {
      return { isEligible: false, reason: 'Customer must be older than 20 to qualify.', score: 0, maxLoanAmount: 0 };
    }

    const product = await prisma.loanProduct.findUnique({ where: { id: productId }});
    if (!product) {
        return { isEligible: false, reason: 'Loan product not found.', score: 0, maxLoanAmount: 0 };
    }

    // Check for active loans if the product doesn't allow multiple loans
    if (!product.allowMultipleLoans) {
        const activeLoanCount = await prisma.loan.count({
            where: { 
                customerId: customerId,
                repaymentStatus: 'Unpaid' 
            }
        });
        if (activeLoanCount > 0) {
            return { isEligible: false, reason: 'You already have an active loan. This product does not allow multiple loans.', score: 0, maxLoanAmount: 0 };
        }
    }
    
    const scoringParameterCount = await prisma.scoringParameter.count({ where: { providerId } });
    if (scoringParameterCount === 0) {
        return { isEligible: false, reason: 'This provider has not configured their credit scoring rules.', score: 0, maxLoanAmount: 0 };
    }
    
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


export async function recalculateScoreAndLoanLimit(customerId: string, providerId: string, productId: string): Promise<{score: number, maxLoanAmount: number}> {
    try {
        const customerData = await getCustomerDataForScoring(customerId);
        if (!customerData) {
             return { score: 0, maxLoanAmount: 0 };
        }
        const age = Number(customerData.age);
        if (!isNaN(age) && age <= 20) {
            return { score: 0, maxLoanAmount: 0 };
        }
        const product = await prisma.loanProduct.findUnique({ where: { id: productId } });
        if (!product) {
            return { score: 0, maxLoanAmount: 0 };
        }
        return await calculateScoreForProvider(customerId, providerId, product.id);
    } catch (error) {
        console.error('Error in recalculateScoreAndLoanLimit:', error);
        return { score: 0, maxLoanAmount: 0 };
    }
}
