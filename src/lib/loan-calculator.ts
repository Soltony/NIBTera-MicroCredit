
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
        if (serviceFeeRule.type === 'fixed') {
            totalDebt += Number(serviceFeeRule.value);
        } else { // percentage
            totalDebt += principal * (Number(serviceFeeRule.value) / 100);
        }
    }

    // 2. Daily Fee (Interest) - Calculated only up to the due date.
    const dailyFeeRule = loanProduct.dailyFeeEnabled ? loanProduct.dailyFee : undefined;
    if (dailyFeeRule && dailyFeeRule.value) {
        // Calculate days from start to the earlier of today or due date.
        const interestEndDate = finalDate > dueDate ? dueDate : finalDate;
        const daysForInterest = differenceInDays(interestEndDate, loanStartDate);

        if (daysForInterest > 0) {
            if (dailyFeeRule.type === 'fixed') {
                totalDebt += Number(dailyFeeRule.value) * daysForInterest;
            } else if (dailyFeeRule.type === 'percentage') {
                if (dailyFeeRule.calculationBase === 'compound') {
                    let compoundedBalance = totalDebt;
                    for (let i = 0; i < daysForInterest; i++) {
                        compoundedBalance += compoundedBalance * (Number(dailyFeeRule.value) / 100);
                    }
                    totalDebt = compoundedBalance;
                } else { // Simple interest on principal
                    totalDebt += principal * (Number(dailyFeeRule.value) / 100) * daysForInterest;
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
             const toDay = rule.toDay === '' || rule.toDay === null || rule.toDay === Infinity ? Infinity : Number(rule.toDay);
             const value = rule.value === '' ? 0 : Number(rule.value);

             if (daysOverdue >= fromDay) {
                 const applicableDaysInTier = Math.min(daysOverdue, toDay) - fromDay + 1;
                 
                 if (applicableDaysInTier > 0) {
                    if (rule.type === 'fixed') {
                        totalDebt += value;
                    } else { // percentageOfPrincipal
                        totalDebt += principal * (value / 100) * applicableDaysInTier;
                    }
                 }
             }
        });
    }

    return totalDebt;
};
