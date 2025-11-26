
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
import { Loan, LoanProduct, Prisma, RepaymentBehavior } from '@prisma/client';


// Helper to convert strings to camelCase
const toCamelCase = (str: string) => {
    if (!str) return '';
    // This regex handles various separators (space, underscore, hyphen) and capitalizes the next letter.
    return str.replace(/[^a-zA-Z0-9]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '').replace(/^./, (match) => match.toLowerCase());
};

async function getBorrowerDataForScoring(
    borrowerId: string, 
    providerId: string, 
): Promise<Record<string, any>> {

    const provisionedDataEntries = await prisma.provisionedData.findMany({
        where: { 
            borrowerId,
            config: {
                providerId: providerId,
            }
        },
        orderBy: { createdAt: 'desc' },
    });


    const combinedData: Record<string, any> = { id: borrowerId };
    
    for (const entry of provisionedDataEntries) {
        try {
            const data = JSON.parse(entry.data as string);
            const standardizedData: Record<string, any> = {};
            for (const key in data) {
                standardizedData[toCamelCase(key)] = data[key];
            }

            for (const key in standardizedData) {
                if (!Object.prototype.hasOwnProperty.call(combinedData, key)) {
                    combinedData[key] = standardizedData[key];
                }
            }
        } catch (e) {
            console.error(`Failed to parse data for entry ${entry.id}:`, e);
        }
    }
    
    const previousLoans = await prisma.loan.findMany({
        where: { borrowerId },
        select: { repaymentBehavior: true },
    });

    combinedData['totalLoansCount'] = previousLoans.length;
    combinedData['loansOnTime'] = previousLoans.filter(l => l.repaymentBehavior === 'ON_TIME').length;
    combinedData['loansLate'] = previousLoans.filter(l => l.repaymentBehavior === 'LATE').length;
    combinedData['loansEarly'] = previousLoans.filter(l => l.repaymentBehavior === 'EARLY').length;
    
    return combinedData;
}


async function calculateScoreForProvider(
    borrowerId: string,
    providerId: string,
): Promise<number> {
    
    const borrowerDataForScoring = await getBorrowerDataForScoring(borrowerId, providerId);
    
    const parameters: ScoringParameterType[] = await prisma.scoringParameter.findMany({
        where: { providerId },
        include: {
            rules: true,
        },
    });
    
    if (parameters.length === 0) {
        return 0;
    }
    
    let totalScore = 0;

    parameters.forEach(param => {
        let maxScoreForParam = 0;
        const relevantRules = param.rules || [];
        
        relevantRules.forEach(rule => {
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

    return Math.round(totalScore);
}


export async function checkLoanEligibility(borrowerId: string, providerId: string, productId: string): Promise<{isEligible: boolean; reason: string; score: number, maxLoanAmount: number}> {
  try {
    const borrower = await prisma.borrower.findUnique({
        where: { id: borrowerId }
    });

    if (!borrower) {
      return { isEligible: false, reason: 'Borrower profile not found.', score: 0, maxLoanAmount: 0 };
    }

    if (borrower.status === 'NPL') {
        return { isEligible: false, reason: 'Your account is currently restricted due to a non-performing loan. Please contact support.', score: 0, maxLoanAmount: 0 };
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
            repaymentStatus: 'Unpaid'
        },
        include: { product: true }
    });

    const hasActiveLoanOfSameType = allActiveLoans.some((loan: LoanWithProduct) => loan.productId === productId);
    if (hasActiveLoanOfSameType) {
        return { isEligible: false, reason: `You already have an active loan for the "${product.name}" product.`, score: 0, maxLoanAmount: 0 };
    }
    
    if (!product.allowConcurrentLoans && allActiveLoans.length > 0) {
        const otherProductNames = allActiveLoans.map(l => `"${l.product.name}"`).join(', ');
        return { isEligible: false, reason: `This is an exclusive loan product. You must repay your active loans (${otherProductNames}) before applying.`, score: 0, maxLoanAmount: 0 };
    }
    
    const borrowerDataForScoring = await getBorrowerDataForScoring(borrowerId, providerId);
    
    if (product.dataProvisioningEnabled && product.eligibilityFilter) {
        const filter = JSON.parse(product.eligibilityFilter as string);
        const filterKeys = Object.keys(filter);

        const isMatch = filterKeys.every(key => {
            const filterValue = String(filter[key]).toLowerCase();
            const borrowerValue = String(borrowerDataForScoring[toCamelCase(key)] || '').toLowerCase();
            return filterValue.split(',').map(s => s.trim()).includes(borrowerValue);
        });

        if (!isMatch) {
            return { isEligible: false, reason: 'This loan product is not available for your profile.', score: 0, maxLoanAmount: 0 };
        }
    }


    const scoringParameterCount = await prisma.scoringParameter.count({ where: { providerId } });
    if (scoringParameterCount === 0) {
        return { isEligible: false, reason: 'This provider has not configured their credit scoring rules.', score: 0, maxLoanAmount: 0 };
    }
    
    const score = await calculateScoreForProvider(borrowerId, providerId);

    const applicableTier = await prisma.loanAmountTier.findFirst({
        where: {
            productId: productId,
            fromScore: { lte: score },
            toScore: { gte: score },
        }
    });
        
    const productMaxLoan = applicableTier?.loanAmount || 0;

    // --- Loan Cycle logic (limits accessible amount based on cycle progression) ---
    let cyclePercentage = 1; // default 100%
    try {
        const cycleConfig = await prisma.loanCycleConfig.findUnique({ where: { productId: productId } });
        if (cycleConfig) {
            // determine metric count
            let metricCount = 0;
            switch ((cycleConfig.metric || '').toUpperCase()) {
                case 'PAID_EARLY':
                    metricCount = borrowerDataForScoring['loansEarly'] || 0;
                    break;
                case 'PAID_LATE':
                    metricCount = borrowerDataForScoring['loansLate'] || 0;
                    break;
                case 'PAID_ON_TIME':
                    metricCount = borrowerDataForScoring['loansOnTime'] || 0;
                    break;
                case 'TOTAL_COUNT':
                    metricCount = borrowerDataForScoring['totalLoansCount'] || 0;
                    break;
                default:
                    metricCount = 0;
            }

            // Prefer new grade-based structure when present
            if (cycleConfig.grades && cycleConfig.cycleRanges) {
                const grades = typeof cycleConfig.grades === 'string' ? JSON.parse(cycleConfig.grades) as Array<{ label: string; minScore: number; percentages: number[] }> : (cycleConfig.grades as any[]);
                const ranges = typeof cycleConfig.cycleRanges === 'string' ? JSON.parse(cycleConfig.cycleRanges) as Array<{ label?: string; min: number; max: number }> : (cycleConfig.cycleRanges as any[]);

                // determine which range index the metricCount falls into
                let idx = 0;
                for (let i = 0; i < ranges.length; i++) {
                    const r = ranges[i];
                    if (typeof r?.min === 'number' && typeof r?.max === 'number') {
                        if (metricCount >= r.min && metricCount <= r.max) {
                            idx = i;
                            break;
                        }
                    }
                }

                // find matching grade by score - choose highest minScore <= score
                let matchedGrade = null as null | (typeof grades)[0];
                const sortedGrades = (grades || []).slice().sort((a, b) => (b?.minScore ?? 0) - (a?.minScore ?? 0));
                for (const g of sortedGrades) {
                    if (typeof g?.minScore === 'number' && score >= g.minScore) {
                        matchedGrade = g;
                        break;
                    }
                }

                if (matchedGrade && Array.isArray(matchedGrade.percentages)) {
                    const pct = matchedGrade.percentages[Math.max(0, Math.min(matchedGrade.percentages.length - 1, idx))];
                    if (typeof pct === 'number') {
                        cyclePercentage = Math.max(0, Math.min(1, pct / 100));
                    }
                } else if (cycleConfig.cycles) {
                    // fallback to legacy cycles if present
                    try {
                        const cyclesArr = typeof cycleConfig.cycles === 'string' ? JSON.parse(cycleConfig.cycles) as number[] : (cycleConfig.cycles as number[]);
                        const legacyIdx = Math.min(metricCount + 1, Math.max(1, cyclesArr.length)) - 1;
                        const pct = cyclesArr[Math.max(0, Math.min(cyclesArr.length - 1, legacyIdx))];
                        if (typeof pct === 'number') {
                            cyclePercentage = Math.max(0, Math.min(1, pct / 100));
                        }
                    } catch (e) {
                        // ignore fallback errors
                    }
                }

            } else if (cycleConfig.cycles) {
                // legacy single-dimension cycles behavior
                const cyclesArr = typeof cycleConfig.cycles === 'string' ? JSON.parse(cycleConfig.cycles) as number[] : (cycleConfig.cycles as number[]);
                // progression rule: 0 -> cycle 1, 1 -> cycle 2, etc., capped to cycles length
                const idx = Math.min(metricCount + 1, Math.max(1, cyclesArr.length)) - 1; // index in array
                const pct = cyclesArr[Math.max(0, Math.min(cyclesArr.length - 1, idx))];
                if (typeof pct === 'number') {
                    cyclePercentage = Math.max(0, Math.min(1, pct / 100));
                }
            }
        }
    } catch (e) {
        console.error('Failed to compute loan cycle for product', productId, e);
    }

    // accessible amount based on cycle
    const accessibleByCycle = Math.floor(productMaxLoan * cyclePercentage);

    if (productMaxLoan <= 0) {
        return { isEligible: false, reason: 'Your credit score does not meet the minimum requirement for a loan with this provider.', score, maxLoanAmount: 0 };
    }
    
    const totalOutstandingPrincipal = allActiveLoans.reduce((sum, loan) => sum + loan.loanAmount - (loan.repaidAmount || 0), 0);
    
    // Effective cap for borrower is the cycle-limited amount
    const effectiveMaxForBorrower = Math.min(productMaxLoan, accessibleByCycle);

    const availableToBorrow = Math.max(0, effectiveMaxForBorrower - totalOutstandingPrincipal);
    
    if (availableToBorrow <= 0 && allActiveLoans.length > 0) {
         return { isEligible: true, reason: `You have reached your credit limit with this provider. Your current outstanding balance is ${totalOutstandingPrincipal}. Please repay your active loans to be eligible for more.`, score, maxLoanAmount: 0 };
    }
        
    return { isEligible: true, reason: 'Congratulations! You are eligible for a loan.', score, maxLoanAmount: availableToBorrow };

  } catch (error) {
    console.error('Error in checkLoanEligibility:', error);
    return { isEligible: false, reason: 'An unexpected server error occurred.', score: 0, maxLoanAmount: 0 };
  }
}
