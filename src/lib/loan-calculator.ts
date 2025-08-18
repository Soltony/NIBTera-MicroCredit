
import { differenceInDays, startOfDay } from 'date-fns';
import type { LoanDetails, LoanProduct } from './types';


export const calculateTotalRepayable = (loanDetails: LoanDetails, loanProduct: LoanProduct, asOfDate: Date = new Date()): number => {
    const loanStartDate = startOfDay(new Date(loanDetails.disbursedDate));
    const finalDate = startOfDay(asOfDate);
    const dueDate = startOfDay(new Date(loanDetails.dueDate));

    const principal = loanDetails.loanAmount;

    let totalDebt = principal;

    // 1. Service Fee
    const serviceFeeRule = loanProduct.serviceFeeEnabled ? loanProduct.serviceFee : undefined;
    if (serviceFeeRule && serviceFeeRule.value) {
        if (serviceFeeRule.type === 'fixed') {
            totalDebt += Number(serviceFeeRule.value);
        } else { // percentage
            totalDebt += principal * (Number(serviceFeeRule.value) / 100);
        }
    }

    // 2. Daily Fee (Interest)
    const dailyFeeRule = loanProduct.dailyFeeEnabled ? loanProduct.dailyFee : undefined;
    if (dailyFeeRule && dailyFeeRule.value) {
        const daysSinceStart = differenceInDays(finalDate, loanStartDate);
        if (daysSinceStart > 0) {
            if (dailyFeeRule.type === 'fixed') {
                totalDebt += Number(dailyFeeRule.value) * daysSinceStart;
            } else { // percentage
                totalDebt += principal * (Number(dailyFeeRule.value) / 100) * daysSinceStart;
            }
        }
    }

    // 3. Penalty
    const penaltyRules = loanProduct.penaltyRulesEnabled ? loanProduct.penaltyRules : [];
    if (penaltyRules && finalDate > dueDate) {
        const daysOverdue = differenceInDays(finalDate, dueDate);
        
        penaltyRules.forEach(rule => {
             const fromDay = rule.fromDay === '' ? 1 : Number(rule.fromDay);
             const toDay = rule.toDay === '' || rule.toDay === Infinity ? Infinity : Number(rule.toDay);
             const value = rule.value === '' ? 0 : Number(rule.value);

             if (daysOverdue >= fromDay) {
                 const applicableDaysInTier = Math.min(daysOverdue, toDay) - fromDay + 1;
                 
                 if (applicableDaysInTier > 0) {
                    if (rule.type === 'fixed') {
                        // Fixed amount is a one-time charge for entering the tier
                        totalDebt += value;
                    } else { // percentageOfPrincipal
                        // Percentage is applied daily for the duration in the tier
                        totalDebt += principal * (value / 100) * applicableDaysInTier;
                    }
                 }
             }
        });
    }

    return totalDebt;
};
