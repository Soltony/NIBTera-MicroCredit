
'use server';
/**
 * @fileOverview Implements a loan eligibility check and credit scoring.
 *
 * - checkLoanEligibility - First checks for basic eligibility (age > 20), then calculates a credit score to determine the maximum loan amount.
 * - recalculateScoreAndLoanLimit - Calculates a credit score for a given provider and returns the max loan amount.
 */

import prisma from '@/lib/prisma';
import { evaluateCondition } from '@/lib/utils';
import type { ScoringParameter as ScoringParameterType } from '@/lib/types';


// Helper to convert strings to camelCase
const toCamelCase = (str: string) => {
    if (!str) return '';
    return str.replace(/[^a-zA-Z0-9]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '').replace(/^./, (match) => match.toLowerCase());
};

async function getBorrowerDataForScoring(borrowerId: string): Promise<Record<string, any>> {
    const provisionedDataEntries = await prisma.provisionedData.findMany({
        where: { borrowerId },
        orderBy: { createdAt: 'desc' },
    });

    const latestProvisionedData: Record<string, any> = {};
    for (const entry of provisionedDataEntries) {
        const data = JSON.parse(entry.data);
        // Newest data gets precedence, but we merge to get a full profile
        // The data is already in camelCase from the upload process.
        Object.assign(latestProvisionedData, { id: borrowerId, ...data });
    }
    return latestProvisionedData;
}


async function calculateScoreForProvider(borrowerId: string, providerId: string, productId: string): Promise<{score: number; maxLoanAmount: number}> {
    
    const borrowerDataForScoring = await getBorrowerDataForScoring(borrowerId);
    
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
            // Standardize the rule's field name to camelCase for lookup
            const fieldNameInCamelCase = toCamelCase(rule.field);
            const inputValue = borrowerDataForScoring[fieldNameInCamelCase];
            
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


export async function checkLoanEligibility(borrowerId: string, providerId: string, productId: string): Promise<{isEligible: boolean; reason: string; score: number, maxLoanAmount: number}> {
  try {
    const borrowerData = await getBorrowerDataForScoring(borrowerId);

    if (!borrowerData || Object.keys(borrowerData).length <= 1) { // has more than just id
      return { isEligible: false, reason: 'Borrower profile not found.', score: 0, maxLoanAmount: 0 };
    }
    
    // Assuming 'age' is a field in the provisioned data, standardized to 'age'
    const age = Number(borrowerData.age);
    if (!isNaN(age) && age <= 20) {
      return { isEligible: false, reason: 'Borrower must be older than 20 to qualify.', score: 0, maxLoanAmount: 0 };
    }

    const product = await prisma.loanProduct.findUnique({ where: { id: productId }});
    if (!product) {
        return { isEligible: false, reason: 'Loan product not found.', score: 0, maxLoanAmount: 0 };
    }

    // Check for active loans if the product doesn't allow multiple loans
    if (!product.allowMultipleLoans) {
        const activeLoanCount = await prisma.loan.count({
            where: { 
                borrowerId: borrowerId,
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
    
    const { score, maxLoanAmount } = await calculateScoreForProvider(borrowerId, providerId, productId);

    if (maxLoanAmount <= 0) {
        return { isEligible: false, reason: 'Your credit score does not meet the minimum requirement for a loan with this provider.', score, maxLoanAmount: 0 };
    }
        
    return { isEligible: true, reason: 'Congratulations! You are eligible for a loan.', score, maxLoanAmount };

  } catch (error) {
    console.error('Error in checkLoanEligibility:', error);
    return { isEligible: false, reason: 'An unexpected server error occurred.', score: 0, maxLoanAmount: 0 };
  }
}


export async function recalculateScoreAndLoanLimit(borrowerId: string, providerId: string, productId: string): Promise<{score: number, maxLoanAmount: number}> {
    try {
        const borrowerData = await getBorrowerDataForScoring(borrowerId);
        if (!borrowerData) {
             return { score: 0, maxLoanAmount: 0 };
        }
        const age = Number(borrowerData.age);
        if (!isNaN(age) && age <= 20) {
            return { score: 0, maxLoanAmount: 0 };
        }
        const product = await prisma.loanProduct.findUnique({ where: { id: productId } });
        if (!product) {
            return { score: 0, maxLoanAmount: 0 };
        }
        return await calculateScoreForProvider(borrowerId, providerId, product.id);
    } catch (error) {
        console.error('Error in recalculateScoreAndLoanLimit:', error);
        return { score: 0, maxLoanAmount: 0 };
    }
}
