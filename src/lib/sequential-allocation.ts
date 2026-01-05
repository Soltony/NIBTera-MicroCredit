/**
 * Sequential Allocation Logic for Installment-Based Repayments
 * 
 * Payments are applied strictly to the active installment first, then overflow
 * to the next installment. No installment merging occurs.
 * 
 * Priority within each installment:
 * 1. Penalty (installment-level + loan-level if applicable)
 * 2. Service Fee (loan-level, only for first installment)
 * 3. Interest (accrued up to as-of date)
 * 4. Tax
 * 5. Principal for the installment
 */

import { differenceInDays, startOfDay } from 'date-fns';
import { roundCurrency } from './interest-accrual';
import type { PenaltyRule, Tax } from './types';

export interface InstallmentDue {
  installmentId: string;
  installmentNumber: number;
  dueDate: Date;
  principalAmount: number; // Original principal for this installment
  principalPaid: number;   // Already paid principal
  isActive: boolean;
  status: string;
}

export interface InstallmentAllocation {
  installmentId: string;
  installmentNumber: number;
  penaltyPaid: number;
  serviceFeePaid: number;
  interestPaid: number;
  taxPaid: number;
  principalPaid: number;
  totalPaid: number;
  isFullyPaid: boolean;
  remainingDue: number;
}

export interface AllocationPreview {
  allocations: InstallmentAllocation[];
  totalPenaltyPaid: number;
  totalServiceFeePaid: number;
  totalInterestPaid: number;
  totalTaxPaid: number;
  totalPrincipalPaid: number;
  totalApplied: number;
  excessAmount: number; // Amount left after all installments are paid
}

export interface InstallmentBreakdown {
  installmentId: string;
  installmentNumber: number;
  dueDate: Date;
  principalDue: number;
  penaltyDue: number;
  serviceFeeDue: number;
  interestDue: number;
  taxDue: number;
  totalDue: number;
  isActive: boolean;
  isOverdue: boolean;
}

/**
 * Calculate penalty for a specific installment based on its due date and outstanding principal
 */
export function calculateInstallmentLevelPenalty(params: {
  dueDate: Date;
  principalOutstanding: number;
  penaltyRules: PenaltyRule[];
  asOfDate: Date;
}): number {
  const { dueDate, principalOutstanding, penaltyRules, asOfDate } = params;

  const principal = Math.max(0, Number(principalOutstanding) || 0);
  if (principal <= 0) return 0;

  const finalDate = startOfDay(asOfDate);
  const instDue = startOfDay(new Date(dueDate));
  if (finalDate <= instDue) return 0;

  const daysOverdue = Math.max(0, differenceInDays(finalDate, instDue));
  if (daysOverdue <= 0) return 0;

  let penaltyComponent = 0;

  for (const rule of penaltyRules || []) {
    const fromDay = (rule as any).fromDay === '' ? 1 : Number((rule as any).fromDay);
    const toDayRaw = (rule as any).toDay === '' || (rule as any).toDay === null ? Infinity : Number((rule as any).toDay);
    const toDay = Number.isFinite(toDayRaw) ? toDayRaw : Infinity;
    const value = (rule as any).value === '' ? 0 : Number((rule as any).value);

    if (!Number.isFinite(fromDay) || fromDay <= 0) continue;
    if (!Number.isFinite(value) || value <= 0) continue;

    if (daysOverdue >= fromDay) {
      const applicableDaysInTier = Math.min(daysOverdue, toDay) - fromDay + 1;
      const isOneTime = (rule as any).frequency === 'one-time';
      const daysToCalculate = isOneTime ? 1 : applicableDaysInTier;
      if (daysToCalculate <= 0) continue;

      if ((rule as any).type === 'fixed') {
        penaltyComponent += value * daysToCalculate;
      } else if ((rule as any).type === 'percentageOfPrincipal') {
        penaltyComponent += principal * (value / 100) * daysToCalculate;
      } else if ((rule as any).type === 'percentageOfCompound') {
        let compoundBase = principal;
        for (let i = 0; i < daysToCalculate; i++) {
          const dailyPenalty = roundCurrency(compoundBase * (value / 100));
          penaltyComponent += dailyPenalty;
          if (!isOneTime) compoundBase += dailyPenalty;
        }
      }
    }
  }

  return roundCurrency(penaltyComponent);
}

/**
 * Get the breakdown of what's due for each installment (without merging)
 */
export function getInstallmentBreakdowns(params: {
  installments: InstallmentDue[];
  penaltyRules: PenaltyRule[];
  penaltyPerInstallment: boolean;
  loanDueDate: Date;
  totalServiceFee: number;
  serviceFeePaid: number;
  totalInterest: number;
  interestPaid: number;
  totalTax: number;
  taxPaid: number;
  asOfDate: Date;
}): InstallmentBreakdown[] {
  const {
    installments,
    penaltyRules,
    penaltyPerInstallment,
    loanDueDate,
    totalServiceFee,
    serviceFeePaid,
    totalInterest,
    interestPaid,
    totalTax,
    taxPaid,
    asOfDate,
  } = params;

  const finalDate = startOfDay(asOfDate);
  const breakdowns: InstallmentBreakdown[] = [];

  // Sort by installment number
  const sortedInstallments = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);

  // Track remaining loan-level amounts to distribute
  let remainingServiceFee = Math.max(0, totalServiceFee - serviceFeePaid);
  let remainingInterest = Math.max(0, totalInterest - interestPaid);
  let remainingTax = Math.max(0, totalTax - taxPaid);

  for (const inst of sortedInstallments) {
    const instDue = startOfDay(new Date(inst.dueDate));
    const isOverdue = finalDate > instDue;
    const principalDue = Math.max(0, inst.principalAmount - inst.principalPaid);

    // Calculate penalty
    let penaltyDue = 0;
    if (penaltyPerInstallment) {
      // Penalty based on installment due date
      penaltyDue = calculateInstallmentLevelPenalty({
        dueDate: inst.dueDate,
        principalOutstanding: principalDue,
        penaltyRules,
        asOfDate,
      });
    } else {
      // Loan-level penalty (only computed once, distributed to first active installment)
      if (inst.isActive) {
        penaltyDue = calculateInstallmentLevelPenalty({
          dueDate: loanDueDate,
          principalOutstanding: principalDue,
          penaltyRules,
          asOfDate,
        });
      }
    }

    // Service fee only applies to first installment
    const serviceFeeDue = inst.installmentNumber === 1 ? remainingServiceFee : 0;
    if (inst.installmentNumber === 1) {
      remainingServiceFee = 0;
    }

    // Interest and tax are distributed proportionally or to active installment
    // For simplicity, assign all remaining interest/tax to the active installment
    let interestDue = 0;
    let taxDue = 0;
    if (inst.isActive) {
      interestDue = remainingInterest;
      taxDue = remainingTax;
      remainingInterest = 0;
      remainingTax = 0;
    }

    const totalDue = roundCurrency(penaltyDue + serviceFeeDue + interestDue + taxDue + principalDue);

    breakdowns.push({
      installmentId: inst.installmentId,
      installmentNumber: inst.installmentNumber,
      dueDate: inst.dueDate,
      principalDue,
      penaltyDue,
      serviceFeeDue,
      interestDue,
      taxDue,
      totalDue,
      isActive: inst.isActive,
      isOverdue,
    });
  }

  return breakdowns;
}

/**
 * Preview how a payment would be allocated across installments sequentially
 */
export function previewSequentialAllocation(params: {
  paymentAmount: number;
  installmentBreakdowns: InstallmentBreakdown[];
}): AllocationPreview {
  const { paymentAmount, installmentBreakdowns } = params;

  let remaining = paymentAmount;
  const allocations: InstallmentAllocation[] = [];

  let totalPenaltyPaid = 0;
  let totalServiceFeePaid = 0;
  let totalInterestPaid = 0;
  let totalTaxPaid = 0;
  let totalPrincipalPaid = 0;

  // Sort by installment number and process sequentially
  const sortedBreakdowns = [...installmentBreakdowns].sort(
    (a, b) => a.installmentNumber - b.installmentNumber
  );

  for (const bd of sortedBreakdowns) {
    if (remaining <= 0) {
      // No more payment to allocate
      allocations.push({
        installmentId: bd.installmentId,
        installmentNumber: bd.installmentNumber,
        penaltyPaid: 0,
        serviceFeePaid: 0,
        interestPaid: 0,
        taxPaid: 0,
        principalPaid: 0,
        totalPaid: 0,
        isFullyPaid: bd.totalDue <= 0,
        remainingDue: bd.totalDue,
      });
      continue;
    }

    // Apply payment in priority order: Penalty -> ServiceFee -> Interest -> Tax -> Principal
    const penaltyPaid = Math.min(remaining, bd.penaltyDue);
    remaining -= penaltyPaid;
    totalPenaltyPaid += penaltyPaid;

    const serviceFeePaid = Math.min(remaining, bd.serviceFeeDue);
    remaining -= serviceFeePaid;
    totalServiceFeePaid += serviceFeePaid;

    const interestPaid = Math.min(remaining, bd.interestDue);
    remaining -= interestPaid;
    totalInterestPaid += interestPaid;

    const taxPaid = Math.min(remaining, bd.taxDue);
    remaining -= taxPaid;
    totalTaxPaid += taxPaid;

    const principalPaid = Math.min(remaining, bd.principalDue);
    remaining -= principalPaid;
    totalPrincipalPaid += principalPaid;

    const totalPaidForInst = penaltyPaid + serviceFeePaid + interestPaid + taxPaid + principalPaid;
    const remainingDue = bd.totalDue - totalPaidForInst;
    const isFullyPaid = remainingDue <= 0.01; // Use small epsilon for float comparison

    allocations.push({
      installmentId: bd.installmentId,
      installmentNumber: bd.installmentNumber,
      penaltyPaid: roundCurrency(penaltyPaid),
      serviceFeePaid: roundCurrency(serviceFeePaid),
      interestPaid: roundCurrency(interestPaid),
      taxPaid: roundCurrency(taxPaid),
      principalPaid: roundCurrency(principalPaid),
      totalPaid: roundCurrency(totalPaidForInst),
      isFullyPaid,
      remainingDue: roundCurrency(Math.max(0, remainingDue)),
    });
  }

  return {
    allocations,
    totalPenaltyPaid: roundCurrency(totalPenaltyPaid),
    totalServiceFeePaid: roundCurrency(totalServiceFeePaid),
    totalInterestPaid: roundCurrency(totalInterestPaid),
    totalTaxPaid: roundCurrency(totalTaxPaid),
    totalPrincipalPaid: roundCurrency(totalPrincipalPaid),
    totalApplied: roundCurrency(paymentAmount - remaining),
    excessAmount: roundCurrency(Math.max(0, remaining)),
  };
}

/**
 * Calculate the total outstanding balance for a loan (full principal view)
 */
export function calculateFullLoanOutstanding(params: {
  installmentBreakdowns: InstallmentBreakdown[];
}): {
  totalPrincipalOutstanding: number;
  totalPenaltyDue: number;
  totalServiceFeeDue: number;
  totalInterestDue: number;
  totalTaxDue: number;
  totalOutstanding: number;
  activeInstallment: InstallmentBreakdown | null;
} {
  const { installmentBreakdowns } = params;

  let totalPrincipalOutstanding = 0;
  let totalPenaltyDue = 0;
  let totalServiceFeeDue = 0;
  let totalInterestDue = 0;
  let totalTaxDue = 0;
  let activeInstallment: InstallmentBreakdown | null = null;

  for (const bd of installmentBreakdowns) {
    totalPrincipalOutstanding += bd.principalDue;
    totalPenaltyDue += bd.penaltyDue;
    totalServiceFeeDue += bd.serviceFeeDue;
    totalInterestDue += bd.interestDue;
    totalTaxDue += bd.taxDue;

    if (bd.isActive && !activeInstallment) {
      activeInstallment = bd;
    }
  }

  return {
    totalPrincipalOutstanding: roundCurrency(totalPrincipalOutstanding),
    totalPenaltyDue: roundCurrency(totalPenaltyDue),
    totalServiceFeeDue: roundCurrency(totalServiceFeeDue),
    totalInterestDue: roundCurrency(totalInterestDue),
    totalTaxDue: roundCurrency(totalTaxDue),
    totalOutstanding: roundCurrency(
      totalPrincipalOutstanding + totalPenaltyDue + totalServiceFeeDue + totalInterestDue + totalTaxDue
    ),
    activeInstallment,
  };
}
