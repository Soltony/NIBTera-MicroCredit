import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { calculateTotalRepayableDetailed } from "@/lib/loan-calculator";
import { startOfDay, isBefore, isEqual, differenceInDays } from "date-fns";
import type { RepaymentBehavior } from "@prisma/client";
import { createAuditLog } from "@/lib/audit-log";
import sendSms from "@/lib/sms";
import {
  MiniAppAuthError,
  requireMiniAppAuthContext,
} from "@/lib/miniapp-auth";
import { getAsOfDate } from "@/lib/date-utils";
import {
  getInstallmentBreakdowns,
  previewSequentialAllocation,
  type InstallmentDue,
} from "@/lib/sequential-allocation";

const paymentSchema = z.object({
  loanId: z.string(),
  amount: z.number().positive(),
  installmentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // repayment actions
  let paymentDetailsForLogging: any = {};
  let borrowerIdForLogging: string | null = null;
  try {
    const ctx = await requireMiniAppAuthContext();
    const body = await req.json();
    const { loanId, amount: paymentAmount } = paymentSchema.parse(body);
    paymentDetailsForLogging = { loanId, amount: paymentAmount };

    const loanForBorrowerId = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { borrowerId: true },
    });
    borrowerIdForLogging = loanForBorrowerId?.borrowerId || null;

    if (
      !borrowerIdForLogging ||
      String(borrowerIdForLogging) !== String(ctx.borrowerId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await createAuditLog({
      actorId: borrowerIdForLogging || "unknown",
      action: "REPAYMENT_INITIATED",
      entity: "LOAN",
      entityId: loanId,
      details: paymentDetailsForLogging,
    });

    const [loan, taxConfigs] = await Promise.all([
      prisma.loan.findUnique({
        where: { id: loanId },
        include: {
          product: {
            include: {
              provider: {
                include: {
                  ledgerAccounts: true,
                },
              },
            },
          },
          installments: {
            orderBy: { installmentNumber: "asc" },
          },
          payments: {
            orderBy: { date: "asc" },
          },
        },
      }),
      prisma.tax.findMany({ where: { status: "ACTIVE" } }),
    ]);

    if (!loan) {
      throw new Error("Loan not found");
    }

    // NO ROLLOVER/MERGE: Installments remain separate. We process payments sequentially.

    const provider = loan.product.provider;
    const paymentDate = getAsOfDate();

    // Safe parse helper
    const safeParse = (field: any, defaultValue: any) => {
      if (typeof field === "string") {
        try {
          return JSON.parse(field);
        } catch (e) {
          return defaultValue;
        }
      }
      return field ?? defaultValue;
    };

    const penaltyRules = safeParse(loan.product.penaltyRules, []);
    const penaltyPerInstallment = (loan.product as any).penaltyPerInstallment ?? false;

    // Calculate detailed totals for interest/serviceFee tracking
    const totals = calculateTotalRepayableDetailed(
      loan as any,
      loan.product as any,
      (taxConfigs ?? []) as any,
      paymentDate
    );

    // Check if this loan has installments
    const hasInstallments = loan.installments && loan.installments.length > 0;

    if (hasInstallments) {
      // SEQUENTIAL INSTALLMENT PAYMENT FLOW (no merge)
      
      // Build installment due list
      const installmentDues: InstallmentDue[] = loan.installments.map((inst) => ({
        installmentId: inst.id,
        installmentNumber: inst.installmentNumber,
        dueDate: inst.dueDate,
        principalAmount: inst.amount || 0,
        principalPaid: inst.paidAmount || 0,
        isActive: inst.isActive || false,
        status: inst.status,
      }));

      // Get breakdowns for each installment
      const breakdowns = getInstallmentBreakdowns({
        installments: installmentDues,
        penaltyRules,
        penaltyPerInstallment,
        loanDueDate: loan.dueDate,
        totalServiceFee: totals.serviceFee,
        serviceFeePaid: totals.serviceFeePaid,
        totalInterest: totals.interest,
        interestPaid: totals.interestPaid,
        totalTax: totals.tax,
        taxPaid: 0, // Tax paid tracking could be added if needed
        asOfDate: paymentDate,
      });

      // Calculate total outstanding
      const totalOutstanding = breakdowns.reduce((sum, bd) => sum + bd.totalDue, 0);

      if (paymentAmount > totalOutstanding + 1e-9) {
        throw new Error("Payment amount exceeds total balance due.");
      }

      // Preview allocation
      const allocationPreview = previewSequentialAllocation({
        paymentAmount,
        installmentBreakdowns: breakdowns,
      });

      // Process the payment in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Get ledger accounts
        const principalReceivable = provider.ledgerAccounts.find(
          (a) => a.category === "Principal" && a.type === "Receivable"
        );
        const penaltyReceivable = provider.ledgerAccounts.find(
          (a) => a.category === "Penalty" && a.type === "Receivable"
        );
        const serviceFeeReceivable = provider.ledgerAccounts.find(
          (a) => a.category === "ServiceFee" && a.type === "Receivable"
        );
        const interestReceivable = provider.ledgerAccounts.find(
          (a) => a.category === "Interest" && a.type === "Receivable"
        );
        const taxReceivable = provider.ledgerAccounts.find(
          (a) => a.category === "Tax" && a.type === "Receivable"
        );
        const principalReceived = provider.ledgerAccounts.find(
          (a) => a.category === "Principal" && a.type === "Received"
        );
        const penaltyReceived = provider.ledgerAccounts.find(
          (a) => a.category === "Penalty" && a.type === "Received"
        );
        const serviceFeeReceived = provider.ledgerAccounts.find(
          (a) => a.category === "ServiceFee" && a.type === "Received"
        );
        const interestReceived = provider.ledgerAccounts.find(
          (a) => a.category === "Interest" && a.type === "Received"
        );
        const taxReceived = provider.ledgerAccounts.find(
          (a) => a.category === "Tax" && a.type === "Received"
        );
        const penaltyIncome = provider.ledgerAccounts.find(
          (a) => a.category === "Penalty" && a.type === "Income"
        );
        const serviceFeeIncome = provider.ledgerAccounts.find(
          (a) => a.category === "ServiceFee" && a.type === "Income"
        );
        const interestIncome = provider.ledgerAccounts.find(
          (a) => a.category === "Interest" && a.type === "Income"
        );

        if (!principalReceivable || !principalReceived) {
          throw new Error("Ledger accounts not configured");
        }

        // Create journal entry
        const journalEntry = await tx.journalEntry.create({
          data: {
            providerId: provider.id,
            loanId: loan.id,
            date: paymentDate,
            description: `Sequential repayment of ${paymentAmount} for loan ${loan.id}`,
          },
        });

        // Process ledger entries for totals
        const { totalPenaltyPaid, totalServiceFeePaid, totalInterestPaid, totalTaxPaid, totalPrincipalPaid } = allocationPreview;

        // Penalty ledger entries
        if (totalPenaltyPaid > 0 && penaltyReceivable && penaltyReceived && penaltyIncome) {
          await tx.ledgerAccount.update({
            where: { id: penaltyReceivable.id },
            data: { balance: { decrement: totalPenaltyPaid } },
          });
          await tx.ledgerAccount.update({
            where: { id: penaltyReceived.id },
            data: { balance: { increment: totalPenaltyPaid } },
          });
          await tx.ledgerAccount.update({
            where: { id: penaltyIncome.id },
            data: { balance: { increment: totalPenaltyPaid } },
          });
          await tx.ledgerEntry.createMany({
            data: [
              { journalEntryId: journalEntry.id, ledgerAccountId: penaltyReceivable.id, type: "Credit", amount: totalPenaltyPaid },
              { journalEntryId: journalEntry.id, ledgerAccountId: penaltyReceived.id, type: "Debit", amount: totalPenaltyPaid },
              { journalEntryId: journalEntry.id, ledgerAccountId: penaltyIncome.id, type: "Credit", amount: totalPenaltyPaid },
            ],
          });
        }

        // Service fee ledger entries
        if (totalServiceFeePaid > 0 && serviceFeeReceivable && serviceFeeReceived && serviceFeeIncome) {
          await tx.ledgerAccount.update({
            where: { id: serviceFeeReceivable.id },
            data: { balance: { decrement: totalServiceFeePaid } },
          });
          await tx.ledgerAccount.update({
            where: { id: serviceFeeReceived.id },
            data: { balance: { increment: totalServiceFeePaid } },
          });
          await tx.ledgerAccount.update({
            where: { id: serviceFeeIncome.id },
            data: { balance: { increment: totalServiceFeePaid } },
          });
          await tx.ledgerEntry.createMany({
            data: [
              { journalEntryId: journalEntry.id, ledgerAccountId: serviceFeeReceivable.id, type: "Credit", amount: totalServiceFeePaid },
              { journalEntryId: journalEntry.id, ledgerAccountId: serviceFeeReceived.id, type: "Debit", amount: totalServiceFeePaid },
              { journalEntryId: journalEntry.id, ledgerAccountId: serviceFeeIncome.id, type: "Credit", amount: totalServiceFeePaid },
            ],
          });
        }

        // Interest ledger entries
        if (totalInterestPaid > 0 && interestReceivable && interestReceived && interestIncome) {
          await tx.ledgerAccount.update({
            where: { id: interestReceivable.id },
            data: { balance: { decrement: totalInterestPaid } },
          });
          await tx.ledgerAccount.update({
            where: { id: interestReceived.id },
            data: { balance: { increment: totalInterestPaid } },
          });
          await tx.ledgerAccount.update({
            where: { id: interestIncome.id },
            data: { balance: { increment: totalInterestPaid } },
          });
          await tx.ledgerEntry.createMany({
            data: [
              { journalEntryId: journalEntry.id, ledgerAccountId: interestReceivable.id, type: "Credit", amount: totalInterestPaid },
              { journalEntryId: journalEntry.id, ledgerAccountId: interestReceived.id, type: "Debit", amount: totalInterestPaid },
              { journalEntryId: journalEntry.id, ledgerAccountId: interestIncome.id, type: "Credit", amount: totalInterestPaid },
            ],
          });
        }

        // Tax ledger entries
        if (totalTaxPaid > 0 && taxReceivable && taxReceived) {
          await tx.ledgerAccount.update({
            where: { id: taxReceivable.id },
            data: { balance: { decrement: totalTaxPaid } },
          });
          await tx.ledgerAccount.update({
            where: { id: taxReceived.id },
            data: { balance: { increment: totalTaxPaid } },
          });
          await tx.ledgerEntry.createMany({
            data: [
              { journalEntryId: journalEntry.id, ledgerAccountId: taxReceivable.id, type: "Credit", amount: totalTaxPaid },
              { journalEntryId: journalEntry.id, ledgerAccountId: taxReceived.id, type: "Debit", amount: totalTaxPaid },
            ],
          });
        }

        // Principal ledger entries
        if (totalPrincipalPaid > 0) {
          await tx.ledgerAccount.update({
            where: { id: principalReceivable.id },
            data: { balance: { decrement: totalPrincipalPaid } },
          });
          await tx.ledgerAccount.update({
            where: { id: principalReceived.id },
            data: { balance: { increment: totalPrincipalPaid } },
          });
          await tx.ledgerEntry.createMany({
            data: [
              { journalEntryId: journalEntry.id, ledgerAccountId: principalReceivable.id, type: "Credit", amount: totalPrincipalPaid },
              { journalEntryId: journalEntry.id, ledgerAccountId: principalReceived.id, type: "Debit", amount: totalPrincipalPaid },
            ],
          });
        }

        // Create payment record
        const paymentRec = await tx.payment.create({
          data: {
            loanId: loan.id,
            amount: paymentAmount,
            date: paymentDate,
            outstandingBalanceBeforePayment: totalOutstanding,
            journalEntryId: journalEntry.id,
          },
        });

        // Update each installment based on allocation
        let allInstallmentsPaid = true;
        let nextActiveInstallmentId: string | null = null;

        for (const alloc of allocationPreview.allocations) {
          const inst = loan.installments.find((i) => i.id === alloc.installmentId);
          if (!inst) continue;

          // Only principal paid counts toward installment paidAmount
          const newPaidAmount = (inst.paidAmount || 0) + alloc.principalPaid;
          const instFullyPaid = newPaidAmount >= (inst.amount || 0) - 0.01;

          const instDueDate = startOfDay(new Date(inst.dueDate));
          const isOverdue = paymentDate > instDueDate;

          await tx.loanInstallment.update({
            where: { id: inst.id },
            data: {
              paidAmount: newPaidAmount,
              paidAt: alloc.totalPaid > 0 ? paymentDate : inst.paidAt,
              status: instFullyPaid ? "Paid" : isOverdue ? "Overdue" : "Pending",
              isActive: !instFullyPaid && inst.isActive, // Keep active until fully paid
            },
          });

          if (!instFullyPaid) {
            allInstallmentsPaid = false;
            if (!nextActiveInstallmentId) {
              nextActiveInstallmentId = inst.id;
            }
          }
        }

        // Activate the next unpaid installment if current one is fully paid
        if (nextActiveInstallmentId) {
          await tx.loanInstallment.update({
            where: { id: nextActiveInstallmentId },
            data: { isActive: true },
          });
        }

        // Update loan repaid amount
        const newRepaidAmount = (loan.repaidAmount || 0) + paymentAmount;
        let repaymentBehavior: RepaymentBehavior | null = null;

        if (allInstallmentsPaid) {
          const today = startOfDay(paymentDate);
          const dueDate = startOfDay(loan.dueDate);
          if (isBefore(today, dueDate)) {
            repaymentBehavior = "EARLY";
          } else if (isEqual(today, dueDate)) {
            repaymentBehavior = "ON_TIME";
          } else {
            repaymentBehavior = "LATE";
          }
        }

        const finalLoan = await tx.loan.update({
          where: { id: loan.id },
          data: {
            repaidAmount: newRepaidAmount,
            repaymentStatus: allInstallmentsPaid ? "Paid" : "Unpaid",
            ...(repaymentBehavior && { repaymentBehavior }),
          },
          include: {
            payments: { orderBy: { date: "asc" } },
            installments: { orderBy: { installmentNumber: "asc" } },
            product: true,
          },
        });

        // Audit log
        await createAuditLog({
          actorId: loan.borrowerId,
          action: "REPAYMENT_SUCCESS",
          entity: "LOAN",
          entityId: loan.id,
          details: {
            loanId: loan.id,
            paymentId: paymentRec.id,
            amount: paymentAmount,
            allocation: allocationPreview,
            repaymentStatus: finalLoan.repaymentStatus,
          },
        });

        // Send SMS notification
        (async () => {
          try {
            const phone = loan.borrowerId;
            const msg = `Payment of ${paymentAmount} ETB received for loan ${loan.id}. Thank you.`;
            const smsRes = await sendSms(String(phone), msg);
            if (!smsRes.ok) console.warn("[payments] sms send failed", smsRes);
          } catch (e) {
            console.error("[payments] sms notify error", e);
          }
        })();

        return finalLoan;
      });

      return NextResponse.json(result, { status: 200 });
    }

    // NON-INSTALLMENT LOAN FLOW (legacy behavior)
    const alreadyRepaid = loan.repaidAmount || 0;
    const totalDue = totals.total - alreadyRepaid;

    const alreadyPaidPenalty = Math.min(totals.penalty, alreadyRepaid);
    const alreadyPaidServiceFee = Math.min(
      totals.serviceFee,
      Math.max(0, alreadyRepaid - totals.penalty)
    );
    const alreadyPaidInterest = Math.min(
      totals.interest,
      Math.max(0, alreadyRepaid - totals.penalty - totals.serviceFee)
    );
    const alreadyPaidTax = Math.min(
      totals.tax,
      Math.max(
        0,
        alreadyRepaid - totals.penalty - totals.serviceFee - totals.interest
      )
    );
    const alreadyPaidPrincipal = Math.min(
      totals.principal,
      Math.max(
        0,
        alreadyRepaid -
          totals.penalty -
          totals.serviceFee -
          totals.interest -
          totals.tax
      )
    );

    const penaltyDue = Math.max(0, totals.penalty - alreadyPaidPenalty);
    const serviceFeeDue = Math.max(
      0,
      totals.serviceFee - alreadyPaidServiceFee
    );
    const interestDue = Math.max(0, totals.interest - alreadyPaidInterest);
    const taxDue = Math.max(0, totals.tax - alreadyPaidTax);
    const principalDue = Math.max(0, totals.principal - alreadyPaidPrincipal);

    if (paymentAmount > totalDue + 1e-9) {
      // Add machine epsilon for float comparison
      throw new Error("Payment amount exceeds balance due.");
    }

    const updatedLoan = await prisma.$transaction(async (tx) => {
      let amountToApply = paymentAmount;

      // Ledger Accounts
      const principalReceivable = provider.ledgerAccounts.find(
        (a) => a.category === "Principal" && a.type === "Receivable"
      );
      const interestReceivable = provider.ledgerAccounts.find(
        (a) => a.category === "Interest" && a.type === "Receivable"
      );
      const penaltyReceivable = provider.ledgerAccounts.find(
        (a) => a.category === "Penalty" && a.type === "Receivable"
      );
      const serviceFeeReceivable = provider.ledgerAccounts.find(
        (a) => a.category === "ServiceFee" && a.type === "Receivable"
      );
      const taxReceivable = provider.ledgerAccounts.find(
        (a) => a.category === "Tax" && a.type === "Receivable"
      );

      const principalReceived = provider.ledgerAccounts.find(
        (a) => a.category === "Principal" && a.type === "Received"
      );
      const interestReceived = provider.ledgerAccounts.find(
        (a) => a.category === "Interest" && a.type === "Received"
      );
      const penaltyReceived = provider.ledgerAccounts.find(
        (a) => a.category === "Penalty" && a.type === "Received"
      );
      const serviceFeeReceived = provider.ledgerAccounts.find(
        (a) => a.category === "ServiceFee" && a.type === "Received"
      );
      const taxReceived = provider.ledgerAccounts.find(
        (a) => a.category === "Tax" && a.type === "Received"
      );

      const interestIncome = provider.ledgerAccounts.find(
        (a) => a.category === "Interest" && a.type === "Income"
      );
      const penaltyIncome = provider.ledgerAccounts.find(
        (a) => a.category === "Penalty" && a.type === "Income"
      );
      const serviceFeeIncome = provider.ledgerAccounts.find(
        (a) => a.category === "ServiceFee" && a.type === "Income"
      );

      if (
        !principalReceivable ||
        !interestReceivable ||
        !penaltyReceivable ||
        !serviceFeeReceivable ||
        !taxReceivable ||
        !principalReceived ||
        !interestReceived ||
        !penaltyReceived ||
        !serviceFeeReceived ||
        !taxReceived
      ) {
        throw new Error(
          `One or more ledger accounts not found for provider ${provider.id}`
        );
      }

      const journalEntry = await tx.journalEntry.create({
        data: {
          providerId: provider.id,
          loanId: loan.id,
          date: paymentDate,
          description: `Repayment of ${paymentAmount} for loan ${loan.id}`,
        },
      });

      // Apply payment according to priority: Penalty -> Service Fee -> Interest -> Tax -> Principal
      const penaltyToPay = Math.min(amountToApply, penaltyDue);
      if (penaltyToPay > 0) {
        await tx.ledgerAccount.update({
          where: { id: penaltyReceivable.id },
          data: { balance: { decrement: penaltyToPay } },
        });
        await tx.ledgerAccount.update({
          where: { id: penaltyReceived.id },
          data: { balance: { increment: penaltyToPay } },
        });
        if (!penaltyIncome)
          throw new Error(
            `Penalty Income ledger account not found for provider ${provider.id}`
          );
        await tx.ledgerAccount.update({
          where: { id: penaltyIncome.id },
          data: { balance: { increment: penaltyToPay } },
        });
        await tx.ledgerEntry.createMany({
          data: [
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: penaltyReceivable.id,
              type: "Credit",
              amount: penaltyToPay,
            },
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: penaltyReceived.id,
              type: "Debit",
              amount: penaltyToPay,
            },
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: penaltyIncome.id,
              type: "Credit",
              amount: penaltyToPay,
            },
          ],
        });
        amountToApply -= penaltyToPay;
      }

      const serviceFeeToPay = Math.min(amountToApply, serviceFeeDue);
      if (serviceFeeToPay > 0) {
        await tx.ledgerAccount.update({
          where: { id: serviceFeeReceivable.id },
          data: { balance: { decrement: serviceFeeToPay } },
        });
        await tx.ledgerAccount.update({
          where: { id: serviceFeeReceived.id },
          data: { balance: { increment: serviceFeeToPay } },
        });
        if (!serviceFeeIncome)
          throw new Error(
            `Service Fee Income ledger account not found for provider ${provider.id}`
          );
        await tx.ledgerAccount.update({
          where: { id: serviceFeeIncome.id },
          data: { balance: { increment: serviceFeeToPay } },
        });
        await tx.ledgerEntry.createMany({
          data: [
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: serviceFeeReceivable.id,
              type: "Credit",
              amount: serviceFeeToPay,
            },
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: serviceFeeReceived.id,
              type: "Debit",
              amount: serviceFeeToPay,
            },
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: serviceFeeIncome.id,
              type: "Credit",
              amount: serviceFeeToPay,
            },
          ],
        });
        amountToApply -= serviceFeeToPay;
      }

      const interestToPay = Math.min(amountToApply, interestDue);
      if (interestToPay > 0) {
        await tx.ledgerAccount.update({
          where: { id: interestReceivable.id },
          data: { balance: { decrement: interestToPay } },
        });
        await tx.ledgerAccount.update({
          where: { id: interestReceived.id },
          data: { balance: { increment: interestToPay } },
        });
        if (!interestIncome)
          throw new Error(
            `Interest Income ledger account not found for provider ${provider.id}`
          );
        await tx.ledgerAccount.update({
          where: { id: interestIncome.id },
          data: { balance: { increment: interestToPay } },
        });
        await tx.ledgerEntry.createMany({
          data: [
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: interestReceivable.id,
              type: "Credit",
              amount: interestToPay,
            },
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: interestReceived.id,
              type: "Debit",
              amount: interestToPay,
            },
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: interestIncome.id,
              type: "Credit",
              amount: interestToPay,
            },
          ],
        });
        amountToApply -= interestToPay;
      }

      const taxToPay = Math.min(amountToApply, taxDue);
      if (taxToPay > 0) {
        await tx.ledgerAccount.update({
          where: { id: taxReceivable.id },
          data: { balance: { decrement: taxToPay } },
        });
        await tx.ledgerAccount.update({
          where: { id: taxReceived.id },
          data: { balance: { increment: taxToPay } },
        });
        await tx.ledgerEntry.createMany({
          data: [
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: taxReceivable.id,
              type: "Credit",
              amount: taxToPay,
            },
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: taxReceived.id,
              type: "Debit",
              amount: taxToPay,
            },
          ],
        });
        amountToApply -= taxToPay;
      }

      const principalToPay = Math.min(amountToApply, principalDue);
      if (principalToPay > 0) {
        await tx.ledgerAccount.update({
          where: { id: principalReceivable.id },
          data: { balance: { decrement: principalToPay } },
        });
        await tx.ledgerAccount.update({
          where: { id: principalReceived.id },
          data: { balance: { increment: principalToPay } },
        });
        await tx.ledgerEntry.createMany({
          data: [
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: principalReceivable.id,
              type: "Credit",
              amount: principalToPay,
            },
            {
              journalEntryId: journalEntry.id,
              ledgerAccountId: principalReceived.id,
              type: "Debit",
              amount: principalToPay,
            },
          ],
        });
      }

      // Create payment record
      const newPayment = await tx.payment.create({
        data: {
          loanId,
          amount: paymentAmount,
          date: paymentDate,
          outstandingBalanceBeforePayment: totalDue,
          journalEntryId: journalEntry.id,
        },
      });

      const newRepaidAmount = alreadyRepaid + paymentAmount;
      const isFullyPaid = newRepaidAmount >= totals.total;
      let repaymentBehavior: RepaymentBehavior | null = null;

      if (isFullyPaid) {
        const today = startOfDay(new Date());
        const dueDate = startOfDay(loan.dueDate);
        if (isBefore(today, dueDate)) {
          repaymentBehavior = "EARLY";
        } else if (isEqual(today, dueDate)) {
          repaymentBehavior = "ON_TIME";
        } else {
          repaymentBehavior = "LATE";
        }
      }

      const finalLoan = await tx.loan.update({
        where: { id: loanId },
        data: {
          repaidAmount: newRepaidAmount,
          repaymentStatus: isFullyPaid ? "Paid" : "Unpaid",
          ...(repaymentBehavior && { repaymentBehavior: repaymentBehavior }),
        },
        include: {
          payments: { orderBy: { date: "asc" } },
          product: true,
        },
      });

      const logDetails = {
        loanId: loan.id,
        paymentId: newPayment.id,
        amount: paymentAmount,
        repaymentStatus: finalLoan.repaymentStatus,
      };
      await createAuditLog({
        actorId: loan.borrowerId,
        action: "REPAYMENT_SUCCESS",
        entity: "LOAN",
        entityId: loan.id,
        details: logDetails,
      });

      // Send SMS notification to borrower for manual repayment
      (async () => {
        try {
          const phone = loan.borrowerId;
          const msg = `Payment of ${paymentAmount} ETB received for loan ${loan.id}. Thank you.`;
          const smsRes = await sendSms(String(phone), msg);
          if (!smsRes.ok) console.warn("[payments] sms send failed", smsRes);
        } catch (e) {
          console.error("[payments] sms notify error", e);
        }
      })();

      return finalLoan;
    });

    return NextResponse.json(updatedLoan, { status: 200 });
  } catch (error: any) {
    if (error instanceof MiniAppAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    const errorMessage =
      error instanceof z.ZodError ? error.errors : (error as Error).message;
    const failureLogDetails = {
      ...paymentDetailsForLogging,
      error: errorMessage,
    };
    await createAuditLog({
      actorId: borrowerIdForLogging || "unknown",
      action: "REPAYMENT_FAILED",
      entity: "LOAN",
      entityId: paymentDetailsForLogging.loanId,
      details: failureLogDetails,
    });
    console.error(
      JSON.stringify({
        ...failureLogDetails,
        timestamp: new Date().toISOString(),
        action: "REPAYMENT_FAILED",
      })
    );

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
