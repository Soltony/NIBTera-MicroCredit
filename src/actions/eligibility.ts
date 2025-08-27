
'use server';
/**
 * @fileOverview Implements a loan eligibility check and credit scoring.
 *
 * - checkLoanEligibility - First checks for basic eligibility, then calculates a credit score to determine the maximum loan amount.
 * - recalculateScoreAndLoanLimit - Calculates a credit score for a given provider and returns the max loan amount.
 */

import prisma from '@/lib/prisma';
import { evaluateCondition } from '@/lib/utils';
import type { ScoringParameter as ScoringParameterType } from '@/lib/types';
import { Loan, LoanProduct, Prisma } from '@prisma/client';


// Helper to convert strings to camelCase
const toCamelCase = (str: string) => {
    if (!str) return '';
    // This regex handles various separators (space, underscore, hyphen) and capitalizes the next letter.
    return str.replace(/[^a-zA-Z0-9]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '').replace(/^./, (match) => match.toLowerCase());
};

async function getBorrowerDataForScoring(borrowerId: string): Promise<Record<string, any>> {
    const provisionedDataEntries = await prisma.provisionedData.findMany({
        where: { borrowerId },
        orderBy: { createdAt: 'desc' }, // newest first
    });

    const combinedData: Record<string, any> = { id: borrowerId };
    
    // Iterate from newest to oldest. If a key already exists, we don't overwrite it,
    // ensuring we keep the value from the most recent entry.
    for (const entry of provisionedDataEntries) {
        try {
            const data = JSON.parse(entry.data as string);
            const standardizedData: Record<string, any> = {};
            for (const key in data) {
                standardizedData[toCamelCase(key)] = data[key];
            }

            for (const key in standardizedData) {
                // Only add the key if it hasn't been added from a more recent entry
                if (!Object.prototype.hasOwnProperty.call(combinedData, key)) {
                    combinedData[key] = standardizedData[key];
                }
            }
        } catch (e) {
            console.error(`Failed to parse data for entry ${entry.id}:`, e);
        }
    }
    return combinedData;
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

    const product = await prisma.loanProduct.findUnique({ 
        where: { id: productId },
    });

    if (!product) {
        return { isEligible: false, reason: 'Loan product not found.', score: 0, maxLoanAmount: 0 };
    }
    
    type LoanWithProduct = Loan & { product: LoanProduct };
    
    const allActiveLoans: LoanWithProduct[] = await prisma.loan.findMany({
        where: {
            borrowerId: borrowerId,
            providerId: providerId,
            repaymentStatus: 'Unpaid'
        },
        include: { product: true }
    });

    // Rule 1: A borrower can never have more than one active loan of the same product type.
    const hasActiveLoanOfSameType = allActiveLoans.some((loan: LoanWithProduct) => loan.productId === productId);
    if (hasActiveLoanOfSameType) {
        return { isEligible: false, reason: `You already have an active loan for the "${product.name}" product.`, score: 0, maxLoanAmount: 0 };
    }
    
    // If we've reached here, the loan is allowed based on active loan rules. Now check scoring.
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
