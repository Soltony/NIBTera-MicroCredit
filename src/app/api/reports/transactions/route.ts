import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { calculateTotalRepayable } from "@/lib/loan-calculator";
import { subDays } from "date-fns";
import { getUserFromSession } from "@/lib/user";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession();
    if (!user || !user.permissions?.["reports"]?.read) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const url = new URL(request.url);
    let providerId = url.searchParams.get("providerId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const isSuperAdminOrRecon =
      user.role === "Super Admin" || user.role === "Reconciliation";
    if (!isSuperAdminOrRecon) {
      providerId = user.loanProviderId || "none";
    }

    const taxConfig = await prisma.tax.findMany();

    const whereAny: any = {
      loanId: { not: null },
      loan: { repaymentStatus: { not: "REVERSED" } },
    };
    if (providerId && providerId !== "all" && providerId !== "none") {
      whereAny.providerId = providerId;
    }
    if (providerId === "none") {
      return NextResponse.json([]);
    }

    if (from || to) {
      whereAny.date = {};
      if (from) whereAny.date.gte = new Date(from);
      if (to) whereAny.date.lte = new Date(to);
    }

    const type = url.searchParams.get("type");

    if (type === "repayment") {
      whereAny.payment = { isNot: null };
    } else if (type === "disbursement") {
      whereAny.payment = { is: null };
    }

    const journalEntries = await prisma.journalEntry.findMany({
      where: whereAny,
      include: {
        loan: {
          include: {
            product: {
              include: { provider: { include: { ledgerAccounts: true } } },
            },
            borrower: {
              include: {
                provisionedData: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            },
          },
        },
        entries: { include: { ledgerAccount: true } },
        payment: true,
      },
      orderBy: { date: "desc" },
      take: 2000,
    });

    const borrowerIds = Array.from(
      new Set(
        journalEntries.map((j) => (j.loan as any)?.borrowerId).filter(Boolean)
      )
    );
    const phoneAccounts =
      borrowerIds.length > 0
        ? await prisma.phoneAccount.findMany({
            where: { phoneNumber: { in: borrowerIds } },
          })
        : [];
    const phoneAccountMap = new Map(
      phoneAccounts.map((p) => [p.phoneNumber, p])
    );

    const providerIds = Array.from(
      new Set(journalEntries.map((j) => j.providerId).filter(Boolean))
    );
    const disbursementWhere: any = {};
    if (providerIds.length > 0) {
      disbursementWhere.OR = [
        { providerId: { in: providerIds } },
        { originalProviderId: { in: providerIds } },
      ];
    }
    if (from || to) {
      disbursementWhere.createdAt = {};
      if (from) disbursementWhere.createdAt.gte = new Date(from);
      if (to) disbursementWhere.createdAt.lte = new Date(to);
    } else {
      disbursementWhere.createdAt = { gte: subDays(new Date(), 90) };
    }

    const disbursementTxs = await prisma.disbursementTransaction.findMany({
      where: disbursementWhere,
    });
    const disbMap = new Map<string, any[]>();
    for (const d of disbursementTxs) {
      const key = String(
        d.creditAccountNormalized || d.creditAccount || ""
      ).trim();
      if (!disbMap.has(key)) disbMap.set(key, []);
      disbMap.get(key)!.push(d);
    }

    // Fetch PendingPayment records to link loanId to transactionId (txnRef)
    // Then use that to look up PaymentTransaction.transactionId as CBS reference
    const loanIds = Array.from(
      new Set(
        journalEntries.map((j) => (j.loan as any)?.id).filter(Boolean)
      )
    );
    
    const pendingPayments = loanIds.length > 0
      ? await prisma.pendingPayment.findMany({
          where: { loanId: { in: loanIds } },
        })
      : [];
    
    // Build map: loanId -> transactionId (txnRef) from PendingPayment
    const loanToTxnRefMap = new Map<string, string>();
    for (const pp of pendingPayments) {
      if (pp.transactionId) {
        loanToTxnRefMap.set(pp.loanId, pp.transactionId);
      }
    }
    
    // Fetch PaymentTransaction records to get CBS reference (transactionId)
    const txnRefs = Array.from(new Set(pendingPayments.map(pp => pp.transactionId).filter(Boolean)));
    const paymentTxs = txnRefs.length > 0
      ? await prisma.paymentTransaction.findMany({
          where: { OR: [{ transactionId: { in: txnRefs } }, { txnRef: { in: txnRefs } }] },
        })
      : [];
    
    // Build map: txnRef -> PaymentTransaction.transactionId (CBS reference)
    const txnRefToCbsRefMap = new Map<string, string>();
    for (const pt of paymentTxs) {
      // PaymentTransaction.transactionId is the CBS reference (FT number)
      if (pt.txnRef && pt.transactionId) {
        txnRefToCbsRefMap.set(pt.txnRef, pt.transactionId);
      }
      if (pt.transactionId) {
        txnRefToCbsRefMap.set(pt.transactionId, pt.transactionId);
      }
    }

    const rows = await Promise.all(
      journalEntries.map(async (je) => {
        const loan = je.loan as any;
        const provider = loan?.product?.provider;

        const totals = loan
          ? calculateTotalRepayable(
              loan as any,
              loan.product as any,
              taxConfig,
              je.date
            )
          : {
              total: 0,
              principal: 0,
              interest: 0,
              serviceFee: 0,
              penalty: 0,
              tax: 0,
            };

        let collected: Record<string, number> = {
          Principal: 0,
          Interest: 0,
          ServiceFee: 0,
          Penalty: 0,
          Tax: 0,
        };
        if (loan) {
          const agg = await prisma.ledgerEntry.groupBy({
            by: ["ledgerAccountId"],
            where: {
              journalEntry: { loanId: loan.id, date: { lte: je.date } },
              ledgerAccount: { type: "Received" },
            },
            _sum: { amount: true },
          });
          for (const g of agg) {
            try {
              const la = await prisma.ledgerAccount.findUnique({
                where: { id: g.ledgerAccountId },
              });
              if (!la) continue;
              const cat = la.category as string;
              collected[cat] = (collected[cat] || 0) + (g._sum.amount || 0);
            } catch (e) {}
          }
        }

        const principalDisbursed = loan?.loanAmount || 0;
        const principalOutstanding = Math.max(
          0,
          (totals.principal || 0) - (collected["Principal"] || 0)
        );
        const interestOutstanding = Math.max(
          0,
          (totals.interest || 0) - (collected["Interest"] || 0)
        );
        const serviceFeeOutstanding = Math.max(
          0,
          (totals.serviceFee || 0) - (collected["ServiceFee"] || 0)
        );
        const penaltyOutstanding = Math.max(
          0,
          (totals.penalty || 0) - (collected["Penalty"] || 0)
        );
        const totalOutstanding =
          principalOutstanding +
          interestOutstanding +
          serviceFeeOutstanding +
          penaltyOutstanding;

        const configuredDebit = process.env.ACCOUNT_NO || null;
        let debitAccounts = configuredDebit
          ? [configuredDebit]
          : (je.entries
              .filter((e) => e.type === "Debit")
              .map((e) => e.ledgerAccount?.name)
              .filter(Boolean) as string[]);
        let creditAccounts = je.entries
          .filter((e) => e.type === "Credit")
          .map((e) => e.ledgerAccount?.name)
          .filter(Boolean);

        const providerLedgerAccounts =
          (je.loan as any)?.product?.provider?.ledgerAccounts || [];
        const disbursementAccount =
          providerLedgerAccounts.find(
            (a: any) => a.category === "Principal" && a.type !== "Receivable"
          ) ||
          providerLedgerAccounts.find((a: any) =>
            /fund|cash|disburse/i.test(a.name)
          ) ||
          providerLedgerAccounts.find((a: any) => a.type === "Received") ||
          providerLedgerAccounts.find((a: any) => a.type === "Income") ||
          null;

        const isDisbursement =
          type === "disbursement" || (!je.payment && !type);
        if (isDisbursement && disbursementAccount)
          creditAccounts = [disbursementAccount.name];

        let customerName: string | null = null;
        try {
          const pa =
            loan && loan.borrowerId
              ? phoneAccountMap.get(loan.borrowerId)
              : null;
          if (pa)
            customerName = pa.name || pa.customerName || pa.accountName || null;
          if (!customerName) {
            const pd = loan?.borrower?.provisionedData?.[0]?.data;
            if (pd) {
              const parsed = JSON.parse(pd);
              customerName =
                parsed.fullName || parsed.name || parsed.customerName || null;
            }
          }
        } catch (e) {}

        const transactionStatus = je.payment ? "COMPLETED" : "POSTED";
        let reference = je.id;

        // --- Get CBS reference for repayments from PaymentTransaction.transactionId ---
        // Link: Loan -> PendingPayment.transactionId (txnRef) -> PaymentTransaction.transactionId (CBS ref)
        if (je.payment && loan?.id) {
          const txnRef = loanToTxnRefMap.get(loan.id);
          if (txnRef) {
            const cbsRef = txnRefToCbsRefMap.get(txnRef);
            if (cbsRef) {
              reference = cbsRef;
            }
          }
        }

        // --- Disbursement Matching by Account + Amount + Date ±3 minutes ---
        let cbsReference: string | null = null;
        let cbsCreditAmount: number | null = null;
        let disbursementCreatedAt: Date | null = null;
        let disbursementStatusCode: number | null = null;
        let disbursementRawResponse: string | null = null;
        let disbursementStatusText: string | null = null;
        let disbursementOutcome: string | null = null;
        let borrowerAccount: string | null = null;

        if (loan && loan.borrowerId) {
          const pa = phoneAccountMap.get(loan.borrowerId) || null;
          borrowerAccount = pa?.accountNumber || null;
          if (!borrowerAccount) {
            try {
              const pd = loan?.borrower?.provisionedData?.[0]?.data;
              if (pd) {
                const parsed = JSON.parse(pd);
                borrowerAccount =
                  parsed.accountNumber ||
                  parsed.account ||
                  parsed.customerAccount ||
                  parsed.account_no ||
                  borrowerAccount;
              }
            } catch (e) {}
          }

          let foundMatch: any = null;

          const normalizedBorrowerAcc = String(borrowerAccount || "")
            .replace(/\D/g, "")
            .replace(/^0+/, "");
          const candidates =
            disbMap.get(String(normalizedBorrowerAcc)) ||
            disbMap.get(String(borrowerAccount)) ||
            [];

          if (candidates.length > 0) {
            // 1️⃣ Filter by exact amount
            const amountMatches = candidates.filter(
              (c) => Math.abs((c.amount || 0) - principalDisbursed) < 0.01
            );

            // 2️⃣ Filter by timestamp ±3 minutes
            const matches = amountMatches.filter((c) => {
              const jeTime = new Date(je.date).getTime();
              const cTime = new Date(c.createdAt).getTime();
              return Math.abs(jeTime - cTime) <= 3 * 60 * 1000; // 3 minutes in ms
            });

            // 3️⃣ Pick the closest timestamp
            if (matches.length > 0) {
              let best = matches[0];
              let bestDiff = Math.abs(
                new Date(best.createdAt).getTime() - new Date(je.date).getTime()
              );
              for (const c of matches) {
                const diff = Math.abs(
                  new Date(c.createdAt).getTime() - new Date(je.date).getTime()
                );
                if (diff < bestDiff) {
                  bestDiff = diff;
                  best = c;
                }
              }
              foundMatch = best;
            }
          }

          // --- Assign matched disbursement record ---
          if (foundMatch) {
            const match = foundMatch;
            disbursementCreatedAt = match.createdAt ?? null;
            disbursementStatusCode = match.statusCode ?? null;
            disbursementRawResponse =
              match.rawResponse ?? match.responsePayload ?? null;

            try {
              const raw = match.rawResponse ?? match.responsePayload ?? null;
              if (raw) {
                let parsed: any =
                  typeof raw === "string"
                    ? JSON.parse(raw.replace(/'/g, '"'))
                    : raw;
                disbursementStatusText =
                  parsed?.status ||
                  parsed?.Status ||
                  parsed?.status_message ||
                  parsed?.message ||
                  (parsed?.status_code ? String(parsed.status_code) : null) ||
                  null;
              }
            } catch (e) {}

            if (
              disbursementStatusCode === 200 ||
              (disbursementStatusText &&
                /success|completed|ok|200/i.test(disbursementStatusText))
            ) {
              disbursementOutcome = "Success";
              cbsReference = match.transactionId ?? null;
              cbsCreditAmount = match.amount ?? null;
            } else {
              disbursementOutcome = "Failure";
              cbsReference = null;
              cbsCreditAmount = 0;
            }
          }
        }

        return {
          provider: provider?.name || null,
          providerId: provider?.id || null,
          loanId: loan?.id || null,
          customerName,
          transactionDate: je.date,
          dueDate: loan?.dueDate || null,
          debitAccount: debitAccounts.join(", "),
          creditAccount: creditAccounts.join(", "),
          transactionStatus,
          reference,
          productType: loan?.product?.name || null,
          borrowerId: loan?.borrowerId || null,
          borrowerAccount,
          principalDisbursed,
          netDisbursed: principalDisbursed,
          principalOutstanding,
          interestOutstanding,
          serviceFeeOutstanding,
          penaltyOutstanding,
          totalOutstanding,
          status: loan?.repaymentStatus || null,
          cbsReference,
          cbsCreditAmount,
          disbursementCreatedAt,
          disbursementStatusCode,
          disbursementRawResponse,
          disbursementStatusText,
          disbursementOutcome,
        };
      })
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("Transactions report error", error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
