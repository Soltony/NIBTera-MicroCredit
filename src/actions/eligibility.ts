
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


async function calculateScoreForProvider(customerId: string, providerId: string, productId: string): Promise<{score: number; maxLoanAmount: number}> {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
        throw new Error('Customer not found for score calculation.');
    }
    
    const parameters: ScoringParameterType[] = await prisma.scoringParameter.findMany({
        where: { providerId },
        include: {
            rules: true,
        },
    });
    
    if (parameters.length === 0) {
        return { score: 0, maxLoanAmount: 0 };
    }
    
    // Fetch latest provisioned data for this customer
    const provisionedDataEntries = await prisma.provisionedData.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
    });

    const latestProvisionedData: Record<string, any> = {};
    for (const entry of provisionedDataEntries) {
        const data = JSON.parse(entry.data);
        Object.assign(latestProvisionedData, data);
    }
    
    let totalScore = 0;
    const customerLoanHistory = JSON.parse(customer.loanHistory as string);

    const customerDataForScoring: Record<string, any> = {
        age: Number(customer.age) || 0,
        monthlyIncome: Number(customer.monthlyIncome) || 0,
        gender: customer.gender,
        educationLevel: customer.educationLevel,
        totalLoans: Number(customerLoanHistory.totalLoans) || 0,
        onTimeRepayments: Number(customerLoanHistory.onTimeRepayments) || 0,
        ...latestProvisionedData,
    };

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
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return { isEligible: false, reason: 'Customer profile not found.', score: 0, maxLoanAmount: 0 };
    }
    
    if (customer.age <= 20) {
      return { isEligible: false, reason: 'Customer must be older than 20 to qualify.', score: 0, maxLoanAmount: 0 };
    }

    const provider = await prisma.loanProvider.findUnique({ where: { id: providerId } });
    if (!provider) {
        return { isEligible: false, reason: 'Loan provider not found.', score: 0, maxLoanAmount: 0 };
    }

    const allActiveLoans = await prisma.loan.findMany({ where: { repaymentStatus: 'Unpaid' } });
    const activeLoansWithThisProvider = allActiveLoans.filter(l => l.providerId === providerId);
    const activeLoansWithOtherProviders = allActiveLoans.filter(l => l.providerId !== providerId);

    if (activeLoansWithThisProvider.length > 0 && !provider.allowMultipleProviderLoans) {
        return { isEligible: false, reason: 'This provider does not allow multiple active loans. Please repay your existing loan first.', score: 0, maxLoanAmount: 0 };
    }

    if (activeLoansWithOtherProviders.length > 0 && !provider.allowCrossProviderLoans) {
        return { isEligible: false, reason: 'This provider does not allow loans if you have active loans with other providers.', score: 0, maxLoanAmount: 0 };
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
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer || customer.age <= 20) {
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

