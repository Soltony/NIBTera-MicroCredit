

import { differenceInDays, startOfDay } from 'date-fns';
import type { LoanDetails, LoanProduct } from './types';

interface CalculatedRepayment {
    total: number;
    principal: number;
    interest: number;
    penalty: number;
    serviceFee: number;
}


export const calculateTotalRepayable = (loanDetails: LoanDetails, loanProduct: LoanProduct, asOfDate: Date = new Date()): CalculatedRepayment => {
    const loanStartDate = startOfDay(new Date(loanDetails.disbursedDate));
    const finalDate = startOfDay(asOfDate);
    const dueDate = startOfDay(new Date(loanDetails.dueDate));

    const principal = loanDetails.loanAmount;
    let interestComponent = 0;
    let penaltyComponent = 0;
    let runningBalanceForPenalty = principal;

    // Safely parse JSON fields from the product
    const safeParse = (field: any, defaultValue: any) => {
        if (typeof field === 'string') {
            try {
                return JSON.parse(field);
            } catch (e) {
                return defaultValue;
            }
        }
        return field || defaultValue;
    };

    const serviceFeeRule = safeParse(loanProduct.serviceFee, undefined);
    const dailyFeeRule = safeParse(loanProduct.dailyFee, undefined);
    const penaltyRules = safeParse(loanProduct.penaltyRules, []);


    // 1. Service Fee (One-time charge)
    const serviceFee = loanDetails.serviceFee || 0;
    
    // 2. Daily Fee (Interest) - Calculated only up to the due date.
    if (loanProduct.dailyFeeEnabled && dailyFeeRule && dailyFeeRule.value) {
        const feeValue = typeof dailyFeeRule.value === 'string' ? parseFloat(dailyFeeRule.value) : dailyFeeRule.value;
        const interestEndDate = finalDate > dueDate ? dueDate : finalDate;
        const daysForInterest = differenceInDays(interestEndDate, loanStartDate);

        if (daysForInterest > 0) {
            if (dailyFeeRule.type === 'fixed') {
                interestComponent = feeValue * daysForInterest;
            } else if (dailyFeeRule.type === 'percentage') {
                if (dailyFeeRule.calculationBase === 'compound') {
                     let compoundInterestBase = principal;
                    for (let i = 0; i < daysForInterest; i++) {
                        const dailyInterest = compoundInterestBase * (feeValue / 100);
                        interestComponent += dailyInterest;
                        compoundInterestBase += dailyInterest;
                    }
                } else { // Simple interest on principal
                    interestComponent = principal * (feeValue / 100) * daysForInterest;
                }
            }
        }
    }
    
    runningBalanceForPenalty += interestComponent + serviceFee;

    // 3. Penalty - Calculated only if overdue.
    if (loanProduct.penaltyRulesEnabled && penaltyRules && penaltyRules.length > 0 && finalDate > dueDate) {
        // For same-day loans (duration=0), penalties start the day after.
        const penaltyStartDate = loanProduct.duration === 0 ? startOfDay(new Date(loanDetails.disbursedDate.getTime() + 86400000)) : dueDate;
        const daysOverdueTotal = differenceInDays(finalDate, penaltyStartDate);
        
        penaltyRules.forEach((rule: any) => {
             const fromDay = rule.fromDay === '' ? 1 : Number(rule.fromDay);
             const toDayRaw = rule.toDay === '' || rule.toDay === null ? Infinity : Number(rule.toDay);
             const toDay = isNaN(toDayRaw) ? Infinity : toDayRaw;
             const value = rule.value === '' ? 0 : Number(rule.value);

             if (daysOverdueTotal >= fromDay) {
                 const applicableDaysInTier = Math.min(daysOverdueTotal, toDay) - fromDay + 1;
                 const isOneTime = rule.frequency === 'one-time';

                 if (applicableDaysInTier > 0) {
                    let penaltyForThisRule = 0;
                    const daysToCalculate = isOneTime ? 1 : applicableDaysInTier;

                    if (rule.type === 'fixed') {
                        penaltyForThisRule = value * daysToCalculate;
                    } else if (rule.type === 'percentageOfPrincipal') {
                        penaltyForThisRule = principal * (value / 100) * daysToCalculate;
                    } else if (rule.type === 'percentageOfCompound') {
                        // This applies the penalty daily on the "running balance"
                        // which includes principal + interest + service fees + previously accrued penalties
                        let compoundPenaltyBase = runningBalanceForPenalty + penaltyComponent;
                        for (let i = 0; i < daysToCalculate; i++) {
                             const dailyPenalty = compoundPenaltyBase * (value / 100);
                             penaltyForThisRule += dailyPenalty;
                             if (!isOneTime) { // Only update base if penalty is compounding daily
                                compoundPenaltyBase += dailyPenalty;
                             }
                        }
                    }
                    penaltyComponent += penaltyForThisRule;
                 }
             }
        });
    }

    const totalDebt = principal + serviceFee + interestComponent + penaltyComponent;

    return {
        total: totalDebt,
        principal: principal,
        serviceFee: serviceFee,
        interest: interestComponent,
        penalty: penaltyComponent,
    };
};
