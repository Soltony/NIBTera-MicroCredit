
import { differenceInDays, startOfDay } from 'date-fns';
import type { LoanDetails, LoanProduct } from './types';


export const calculateTotalRepayable = (loanDetails: LoanDetails, loanProduct: LoanProduct, asOfDate: Date = new Date()): number => {
    const loanStartDate = startOfDay(new Date(loanDetails.disbursedDate));
    const finalDate = startOfDay(asOfDate);
    const dueDate = startOfDay(new Date(loanDetails.dueDate));

    const principal = loanDetails.loanAmount;

    let totalDebt = principal;

    // 1. Service Fee (One-time charge)
    const serviceFeeRule = loanProduct.serviceFeeEnabled ? loanProduct.serviceFee : undefined;
    if (serviceFeeRule && serviceFeeRule.value) {
        const feeValue = typeof serviceFeeRule.value === 'string' ? parseFloat(serviceFeeRule.value) : serviceFeeRule.value;
        if (serviceFeeRule.type === 'fixed') {
            totalDebt += feeValue;
        } else { // percentage
            totalDebt += principal * (feeValue / 100);
        }
    }

    // 2. Daily Fee (Interest) - Calculated only up to the due date.
    const dailyFeeRule = loanProduct.dailyFeeEnabled ? loanProduct.dailyFee : undefined;
    if (dailyFeeRule && dailyFeeRule.value) {
        const feeValue = typeof dailyFeeRule.value === 'string' ? parseFloat(dailyFeeRule.value) : dailyFeeRule.value;
        const interestEndDate = finalDate > dueDate ? dueDate : finalDate;
        const daysForInterest = differenceInDays(interestEndDate, loanStartDate);

        if (daysForInterest > 0) {
            if (dailyFeeRule.type === 'fixed') {
                totalDebt += feeValue * daysForInterest;
            } else if (dailyFeeRule.type === 'percentage') {
                if (dailyFeeRule.calculationBase === 'compound') {
                    for (let i = 0; i < daysForInterest; i++) {
                        totalDebt += totalDebt * (feeValue / 100);
                    }
                } else { // Simple interest on principal
                    totalDebt += principal * (feeValue / 100) * daysForInterest;
                }
            }
        }
    }

    // 3. Penalty - Calculated only if overdue.
    const penaltyRules = loanProduct.penaltyRulesEnabled ? loanProduct.penaltyRules : [];
    if (penaltyRules.length > 0 && finalDate > dueDate) {
        const daysOverdue = differenceInDays(finalDate, dueDate);
        
        penaltyRules.forEach(rule => {
             const fromDay = rule.fromDay === '' ? 1 : Number(rule.fromDay);
             const toDayRaw = rule.toDay === '' || rule.toDay === null ? Infinity : Number(rule.toDay);
             const toDay = isNaN(toDayRaw) ? Infinity : toDayRaw;
             const value = rule.value === '' ? 0 : Number(rule.value);

             if (daysOverdue >= fromDay) {
                 const applicableDaysInTier = Math.min(daysOverdue, toDay) - fromDay + 1;
                 
                 if (applicableDaysInTier > 0) {
                    if (rule.type === 'fixed') {
                        // Fixed penalty is a one-time charge for entering the tier
                        totalDebt += value;
                    } else if (rule.type === 'percentageOfPrincipal') {
                        // Percentage penalty is per day on the original principal
                        totalDebt += principal * (value / 100) * applicableDaysInTier;
                    } else if (rule.type === 'percentageOfCompound') {
                        // Percentage penalty is per day on the current total debt
                         for (let i = 0; i < applicableDaysInTier; i++) {
                            totalDebt += totalDebt * (value / 100);
                        }
                    }
                 }
             }
        });
    }

    return totalDebt;
};
