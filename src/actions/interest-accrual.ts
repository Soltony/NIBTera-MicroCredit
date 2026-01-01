'use server';

import prisma from '@/lib/prisma';
import { startOfDay } from 'date-fns';
import { calculateInterestWithPayments, normalizePayments } from '@/lib/interest-accrual';

const safeJsonParse = <T,>(field: any, defaultValue: T): T => {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field) as T;
    } catch {
      return defaultValue;
    }
  }
  return (field ?? defaultValue) as T;
};

export async function runDailyInterestAccrualOnce(asOf: Date = new Date()): Promise<{
  success: boolean;
  accrualThroughDate: Date;
  processedLoans: number;
  totalAccrued: number;
  skippedLoans: number;
}> {
  const accrualThroughDate = startOfDay(asOf); // accrue interest for days strictly before "today"

  const loans = await prisma.loan.findMany({
    where: {
      repaymentStatus: 'Unpaid',
      disbursedDate: { lt: accrualThroughDate },
    },
    include: {
      payments: { orderBy: { date: 'asc' } },
      product: {
        include: {
          provider: { include: { ledgerAccounts: true } },
        },
      },
    },
  });

  let processedLoans = 0;
  let skippedLoans = 0;
  let totalAccrued = 0;

  for (const loan of loans) {
    const loanStartDate = startOfDay(new Date(loan.disbursedDate));
    const dueDate = startOfDay(new Date(loan.dueDate));
    const interestEndDate = accrualThroughDate > dueDate ? dueDate : accrualThroughDate;

    const lastThroughRaw = (loan as any).interestAccruedThroughDate as Date | null | undefined;
    const lastThrough = lastThroughRaw ? startOfDay(new Date(lastThroughRaw)) : loanStartDate;
    if (interestEndDate <= lastThrough) {
      skippedLoans++;
      continue;
    }

    const dailyFeeRule = safeJsonParse<any>((loan.product as any).dailyFee, undefined);
    if (!loan.product.dailyFeeEnabled || !dailyFeeRule || !dailyFeeRule.value || Number(dailyFeeRule.value) <= 0) {
      // No daily fee => nothing to accrue
      await prisma.loan.update({
        where: { id: loan.id },
        data: { interestAccruedThroughDate: interestEndDate } as any,
      });
      skippedLoans++;
      continue;
    }

    const feeValue = typeof dailyFeeRule.value === 'string' ? Number(dailyFeeRule.value) : Number(dailyFeeRule.value);
    const payments = normalizePayments((loan as any).payments);

    // Compute total interest through interestEndDate, then subtract already accrued.
    // This ensures catch-up works even if the job didn't run for multiple days.
    const totalInterestToDate = calculateInterestWithPayments({
      principal: loan.loanAmount,
      loanStartDate,
      interestEndDate,
      dailyFeeRule: {
        type: dailyFeeRule.type,
        value: feeValue,
        calculationBase: dailyFeeRule.calculationBase,
      },
      serviceFee: loan.serviceFee,
      payments,
    });

    const alreadyAccrued = Number((loan as any).interestAccruedAmount ?? 0);
    const delta = totalInterestToDate - alreadyAccrued;

    // Ignore tiny negative/near-zero drift
    if (delta <= 0.000001) {
      await prisma.loan.update({
        where: { id: loan.id },
        data: { interestAccruedThroughDate: interestEndDate } as any,
      });
      skippedLoans++;
      continue;
    }

    const provider = (loan.product as any).provider;

    const interestReceivable = provider.ledgerAccounts.find((a: any) => a.category === 'Interest' && a.type === 'Receivable');
    const interestIncome = provider.ledgerAccounts.find((a: any) => a.category === 'Interest' && a.type === 'Income');

    if (!interestReceivable || !interestIncome) {
      throw new Error(`Interest ledger accounts not configured for provider ${provider.id}`);
    }

    await prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          providerId: provider.id,
          loanId: loan.id,
          date: interestEndDate,
          description: `Daily interest accrual through ${interestEndDate.toISOString().slice(0, 10)} for loan ${loan.id}`,
        },
      });

      await tx.ledgerEntry.createMany({
        data: [
          { journalEntryId: journalEntry.id, ledgerAccountId: interestReceivable.id, type: 'Debit', amount: delta },
          { journalEntryId: journalEntry.id, ledgerAccountId: interestIncome.id, type: 'Credit', amount: delta },
        ],
      });

      await tx.ledgerAccount.update({ where: { id: interestReceivable.id }, data: { balance: { increment: delta } } });
      await tx.ledgerAccount.update({ where: { id: interestIncome.id }, data: { balance: { increment: delta } } });

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          interestAccruedAmount: alreadyAccrued + delta,
          interestAccruedThroughDate: interestEndDate,
        } as any,
      });
    });

    processedLoans++;
    totalAccrued += delta;
  }

  return {
    success: true,
    accrualThroughDate,
    processedLoans,
    totalAccrued,
    skippedLoans,
  };
}
