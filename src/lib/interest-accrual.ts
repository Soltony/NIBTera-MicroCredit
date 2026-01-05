import { addDays, differenceInDays, startOfDay } from 'date-fns';

// Helper to round to 2 decimal places for currency
export const roundCurrency = (amount: number): number => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

export type SafePayment = {
  amount: number;
  date: Date;
};

export const normalizePayments = (payments: any): SafePayment[] => {
  if (!Array.isArray(payments)) return [];
  return payments
    .map((p: any) => ({
      amount: typeof p?.amount === 'string' ? Number(p.amount) : Number(p?.amount),
      date: new Date(p?.date),
    }))
    .filter(p => Number.isFinite(p.amount) && p.amount > 0 && !Number.isNaN(p.date.getTime()));
};

export type DailyFeeRuleInput = {
  type: 'fixed' | 'percentage';
  value: number;
  calculationBase?: 'principal' | 'compound';
};

export type DailyInterestAccrual = {
  date: Date; // startOfDay
  interest: number; // currency-rounded daily interest accrued for this day
};

export type SimulationResult = {
  accruals: DailyInterestAccrual[];
  interestPaid: number;
  serviceFeePaid: number;
  principalPaid: number;
};

/**
 * Simulates daily interest accrual day-by-day, applying payments at start-of-day.
 * Payment priority is: serviceFee -> accruedInterest -> principal.
 *
 * Interest is accrued for each day in [loanStartDate, interestEndDate).
 */
export const simulateDailyInterestAccrual = (params: {
  principal: number;
  loanStartDate: Date;
  interestEndDate: Date;
  dailyFeeRule: DailyFeeRuleInput;
  serviceFee: number;
  payments: SafePayment[];
}): SimulationResult => {
  const { principal, loanStartDate, interestEndDate, dailyFeeRule, serviceFee, payments } = params;

  const daysForInterest = differenceInDays(interestEndDate, loanStartDate);
  if (daysForInterest <= 0) return { accruals: [], interestPaid: 0, serviceFeePaid: 0, principalPaid: 0 };

  if (dailyFeeRule.type === 'fixed') {
    const daily = roundCurrency(dailyFeeRule.value);
    const accruals = Array.from({ length: daysForInterest }, (_, i) => ({
      date: addDays(loanStartDate, i),
      interest: daily,
    }));
    // For fixed daily fee, payments don't reduce interest - just return totals
    // Note: This simplified path doesn't track payment allocation for fixed fees
    return { accruals, interestPaid: 0, serviceFeePaid: 0, principalPaid: 0 };
  }

  const dailyRate = dailyFeeRule.value / 100;
  if (dailyRate <= 0) return { accruals: [], interestPaid: 0, serviceFeePaid: 0, principalPaid: 0 };

  const paymentsByDay = new Map<number, number>();
  for (const payment of payments) {
    const day = startOfDay(payment.date);
    if (day < loanStartDate || day >= interestEndDate) continue;
    paymentsByDay.set(day.getTime(), (paymentsByDay.get(day.getTime()) ?? 0) + payment.amount);
  }

  let serviceFeePaid = 0;
  let interestPaid = 0;
  let principalPaid = 0;

  let interestAccrued = 0;
  let principalOutstanding = principal;
  let compoundBase = principal;

  const isCompound = dailyFeeRule.calculationBase === 'compound';

  const accruals: DailyInterestAccrual[] = [];

  for (let dayIndex = 0; dayIndex < daysForInterest; dayIndex++) {
    const day = addDays(loanStartDate, dayIndex);
    let paymentAmount = paymentsByDay.get(day.getTime()) ?? 0;

    if (paymentAmount > 0) {
      const serviceFeeDue = Math.max(0, serviceFee - serviceFeePaid);
      const serviceFeeToPay = Math.min(paymentAmount, serviceFeeDue);
      serviceFeePaid += serviceFeeToPay;
      paymentAmount -= serviceFeeToPay;

      const interestDue = Math.max(0, interestAccrued - interestPaid);
      const interestToPay = Math.min(paymentAmount, interestDue);
      interestPaid += interestToPay;
      paymentAmount -= interestToPay;

      const principalDue = Math.max(0, principal - principalPaid);
      const principalToPay = Math.min(paymentAmount, principalDue);
      principalPaid += principalToPay;
      paymentAmount -= principalToPay;

      if (isCompound) {
        compoundBase = Math.max(0, compoundBase - interestToPay - principalToPay);
      } else {
        principalOutstanding = Math.max(0, principalOutstanding - principalToPay);
      }
    }

    let dailyInterest = 0;
    if (isCompound) {
      dailyInterest = roundCurrency(compoundBase * dailyRate);
      interestAccrued += dailyInterest;
      compoundBase += dailyInterest;
    } else {
      dailyInterest = roundCurrency(principalOutstanding * dailyRate);
      interestAccrued += dailyInterest;
    }

    accruals.push({ date: day, interest: dailyInterest });
  }

  return { accruals, interestPaid, serviceFeePaid, principalPaid };
};

export type InterestWithPaymentsResult = {
  totalInterest: number;
  interestPaid: number;
  serviceFeePaid: number;
  principalPaid: number;
};

export const calculateInterestWithPayments = (params: {
  principal: number;
  loanStartDate: Date;
  interestEndDate: Date;
  dailyFeeRule: DailyFeeRuleInput;
  serviceFee: number;
  payments: SafePayment[];
}): number => {
  const result = calculateInterestWithPaymentsDetailed(params);
  return result.totalInterest;
};

export const calculateInterestWithPaymentsDetailed = (params: {
  principal: number;
  loanStartDate: Date;
  interestEndDate: Date;
  dailyFeeRule: DailyFeeRuleInput;
  serviceFee: number;
  payments: SafePayment[];
}): InterestWithPaymentsResult => {
  const { dailyFeeRule } = params;

  const result = simulateDailyInterestAccrual(params);
  if (result.accruals.length === 0) {
    return { totalInterest: 0, interestPaid: 0, serviceFeePaid: 0, principalPaid: 0 };
  }

  // For fixed-per-day: sum is exact; for percentage: we intentionally round daily in the simulation
  // so this total matches what would be posted to the ledger in a daily accrual process.
  const total = result.accruals.reduce((sum, a) => sum + a.interest, 0);

  if (dailyFeeRule.type === 'fixed') {
    // avoid cumulative floating drift for long durations
    return {
      totalInterest: roundCurrency(total),
      interestPaid: roundCurrency(result.interestPaid),
      serviceFeePaid: roundCurrency(result.serviceFeePaid),
      principalPaid: roundCurrency(result.principalPaid),
    };
  }

  return {
    totalInterest: roundCurrency(total),
    interestPaid: roundCurrency(result.interestPaid),
    serviceFeePaid: roundCurrency(result.serviceFeePaid),
    principalPaid: roundCurrency(result.principalPaid),
  };
};
