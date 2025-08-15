
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInDays, startOfDay } from 'date-fns';
import type { LoanDetails, LoanProduct } from './types';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const calculateTotalRepayable = (loanDetails: LoanDetails, loanProduct: LoanProduct, asOfDate: Date = new Date()): number => {
    const loanStartDate = startOfDay(new Date(loanDetails.disbursedDate));
    const finalDate = startOfDay(asOfDate);
    const dueDate = startOfDay(new Date(loanDetails.dueDate));

    const principal = loanDetails.loanAmount;

    let totalDebt = principal;

    // 1. Service Fee
    const serviceFeeRule = loanProduct.serviceFee;
    if (serviceFeeRule && serviceFeeRule.value) {
        if (serviceFeeRule.type === 'fixed') {
            totalDebt += serviceFeeRule.value;
        } else { // percentage
            totalDebt += principal * (serviceFeeRule.value / 100);
        }
    }

    // 2. Daily Fee (Interest)
    const dailyFeeRule = loanProduct.dailyFee;
    if (dailyFeeRule && dailyFeeRule.value) {
        const daysSinceStart = differenceInDays(finalDate, loanStartDate);
        if (daysSinceStart > 0) {
            if (dailyFeeRule.type === 'fixed') {
                totalDebt += dailyFeeRule.value * daysSinceStart;
            } else { // percentage
                totalDebt += principal * (dailyFeeRule.value / 100) * daysSinceStart;
            }
        }
    }

    // 3. Penalty
    const penaltyRules = loanProduct.penaltyRules;
    if (penaltyRules && finalDate > dueDate) {
        const daysOverdue = differenceInDays(finalDate, dueDate);
        
        penaltyRules.forEach(rule => {
             const fromDay = rule.fromDay === '' ? 1 : rule.fromDay;
             const toDay = rule.toDay === '' || rule.toDay === Infinity ? Infinity : rule.toDay;
             const value = rule.value === '' ? 0 : rule.value;

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

export const evaluateCondition = (inputValue: string | number | undefined, condition: string, ruleValue: string): boolean => {
    if (inputValue === undefined) return false;

    const numericInputValue = typeof inputValue === 'string' ? parseFloat(inputValue) : inputValue;
    const isNumericComparison = !isNaN(numericInputValue) && !isNaN(parseFloat(ruleValue.split('-')[0]));
    
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
            case '==': return String(inputValue).toLowerCase() == ruleValue.toLowerCase();
            case '!=': return String(inputValue).toLowerCase() != ruleValue.toLowerCase();
            default: return false; // Other operators are not supported for strings
        }
    }
};
