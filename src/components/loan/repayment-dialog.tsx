"use client";

import { useState, useMemo, useEffect } from "react";
import type { LoanDetails, Tax } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Delete, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateTotalRepayableDetailed } from "@/lib/loan-calculator";
import { calculateInstallmentPenalty } from "@/lib/installment-penalty";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle } from "lucide-react";

const formatCurrency = (amount: number) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "0.00";
  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + " ETB"
  );
};

interface RepaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  loan: LoanDetails;
  totalBalanceDue: number;
  providerColor?: string;
  taxConfigs: Tax[];
  asOfDate: Date;
}

// Extend the window type to include myJsChannel
declare global {
  interface Window {
    myJsChannel?: {
      postMessage: (message: any) => void;
    };
  }
}

export function RepaymentDialog({
  isOpen,
  onClose,
  onConfirm,
  loan,
  totalBalanceDue,
  providerColor = "#fdb913",
  taxConfigs,
  asOfDate,
}: RepaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setAmount(totalBalanceDue.toFixed(2));
      setError("");
      setIsProcessing(false);
    }
  }, [isOpen, totalBalanceDue]);

  const remainingAmount = useMemo(() => {
    const enteredAmount = parseFloat(amount) || 0;
    return totalBalanceDue - enteredAmount;
  }, [amount, totalBalanceDue]);

  const validateAmount = (value: string) => {
    const numericAmount = parseFloat(value);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid amount.");
      return false;
    }
    if (numericAmount > totalBalanceDue + 1e-9) {
      // Use a small epsilon for float comparison
      setError(
        `Amount cannot be more than the balance due of ${formatCurrency(
          totalBalanceDue
        )}.`
      );
      return false;
    }
    setError("");
    return true;
  };

  const handleNumberClick = (num: string) => {
    if (num === "." && amount.includes(".")) return;
    const newAmount = amount + num;
    setAmount(newAmount);
    validateAmount(newAmount);
  };

  const handleBackspace = () => {
    const newAmount = amount.slice(0, -1);
    setAmount(newAmount);
    validateAmount(newAmount);
  };

  const handleConfirm = async () => {
    const numericAmount = parseFloat(amount);
    if (!validateAmount(amount) || isNaN(numericAmount)) {
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      // Step 1: Call our backend to get the payment token
      const initiateResponse = await fetch("/api/initiate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numericAmount, loanId: loan.id }),
      });

      if (!initiateResponse.ok) {
        const errorData = await initiateResponse.json();
        throw new Error(errorData.error || "Failed to initiate payment.");
      }

      const { paymentToken, transactionId } = await initiateResponse.json();

      // Step 2: Post the payment token to the Super App via JS Channel
      if (typeof window !== "undefined" && window.myJsChannel?.postMessage) {
        window.myJsChannel.postMessage(JSON.stringify({ token: paymentToken }));

        toast({
          title: "Processing Payment",
          description:
            "Your payment request has been sent to the Super App for completion.",
        });

        // NOTE: The actual loan update will happen when the callback is received.
        // For a better UX, we optimistically close the dialog.
        onClose();
      } else {
        console.error("NIB Super App channel (window.myJsChannel) not found.");
        throw new Error("Could not communicate with the payment app.");
      }
    } catch (err: any) {
      setError(err.message || "An unknown error occurred during payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const numberPadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  const activeInstallment = useMemo(() => {
    const installments = Array.isArray((loan as any)?.installments)
      ? (loan as any).installments
      : [];
    return installments.find((i: any) => i && i.isActive);
  }, [loan]);

  // Get all unpaid installments for allocation preview
  const unpaidInstallments = useMemo(() => {
    const installments = Array.isArray((loan as any)?.installments)
      ? (loan as any).installments
      : [];
    return installments
      .filter((i: any) => i && i.status !== "Paid")
      .sort((a: any, b: any) => a.installmentNumber - b.installmentNumber);
  }, [loan]);

  const isInstallmentPayment = !!activeInstallment;

  const breakdown = useMemo(() => {
    if (!loan || !loan.product)
      return { principal: 0, interest: 0, penalty: 0, serviceFee: 0, tax: 0 };

    // Calculate totals with detailed breakdown of what's been paid
    const totals = calculateTotalRepayableDetailed(
      loan,
      loan.product,
      taxConfigs,
      asOfDate
    );
    const penaltyRules = (loan.product as any).penaltyRules || [];
    const penaltyPerInstallment =
      (loan.product as any).penaltyPerInstallment ?? false;

    // For installment-based loans - show FULL loan breakdown (all installments)
    if (isInstallmentPayment && unpaidInstallments.length > 0) {
      // Sum all unpaid installment principals
      let totalPrincipal = 0;
      let totalPenalty = 0;

      for (const inst of unpaidInstallments) {
        const instPrincipalRemaining = Math.max(
          0,
          (inst.amount || 0) - (inst.paidAmount || 0)
        );
        totalPrincipal += instPrincipalRemaining;

        // Calculate penalty for this installment if penaltyPerInstallment is enabled
        if (penaltyPerInstallment && instPrincipalRemaining > 0) {
          totalPenalty += calculateInstallmentPenalty({
            dueDate: new Date(inst.dueDate),
            principalOutstanding: instPrincipalRemaining,
            penaltyRules,
            asOfDate,
          });
        }
      }

      // If loan-level penalty (not per-installment), calculate once
      if (!penaltyPerInstallment) {
        totalPenalty = calculateInstallmentPenalty({
          dueDate: new Date(loan.dueDate),
          principalOutstanding: totalPrincipal,
          penaltyRules,
          asOfDate,
        });
      }

      // Service fee remaining
      const serviceFeeDue = Math.max(
        0,
        totals.serviceFee - totals.serviceFeePaid
      );

      // Interest remaining
      const interestDue = Math.max(0, totals.interest - totals.interestPaid);

      // Tax remaining
      const totalTaxableOriginal = totals.interest + totals.serviceFee;
      const totalTaxableDue = interestDue + serviceFeeDue;
      const taxDue =
        totalTaxableOriginal > 0
          ? Math.max(0, (totals.tax / totalTaxableOriginal) * totalTaxableDue)
          : 0;

      return {
        principal: Math.round(totalPrincipal * 100) / 100,
        interest: Math.round(interestDue * 100) / 100,
        penalty: Math.round(totalPenalty * 100) / 100,
        serviceFee: Math.round(serviceFeeDue * 100) / 100,
        tax: Math.round(taxDue * 100) / 100,
      };
    }

    // For non-installment loans
    const alreadyRepaid = loan.repaidAmount || 0;
    let remaining = alreadyRepaid;

    const penaltyPaid = Math.min(totals.penalty, remaining);
    remaining = Math.max(0, remaining - penaltyPaid);

    const serviceFeePaid = Math.min(totals.serviceFee, remaining);
    remaining = Math.max(0, remaining - serviceFeePaid);

    const interestPaid = Math.min(totals.interest, remaining);
    remaining = Math.max(0, remaining - interestPaid);

    const taxPaid = Math.min(totals.tax, remaining);
    remaining = Math.max(0, remaining - taxPaid);

    const principalPaid = remaining;

    return {
      principal: Math.max(0, totals.principal - principalPaid),
      serviceFee: Math.max(0, totals.serviceFee - serviceFeePaid),
      interest: Math.max(0, totals.interest - interestPaid),
      penalty: Math.max(0, totals.penalty - penaltyPaid),
      tax: Math.max(0, totals.tax - taxPaid),
    };
  }, [loan, taxConfigs, isInstallmentPayment, unpaidInstallments, asOfDate]);

  // Calculate allocation preview based on entered amount
  const allocationPreview = useMemo(() => {
    const enteredAmount = parseFloat(amount) || 0;
    if (
      enteredAmount <= 0 ||
      !isInstallmentPayment ||
      unpaidInstallments.length === 0
    ) {
      return null;
    }

    const penaltyRules = (loan?.product as any)?.penaltyRules || [];
    const penaltyPerInstallment =
      (loan?.product as any)?.penaltyPerInstallment ?? false;
    const totals = loan?.product
      ? calculateTotalRepayableDetailed(
          loan,
          loan.product,
          taxConfigs,
          asOfDate
        )
      : null;

    let remaining = enteredAmount;
    const allocations: {
      installmentNumber: number;
      principal: number;
      penalty: number;
      serviceFee: number;
      interest: number;
      tax: number;
      total: number;
    }[] = [];

    // Track loan-level fees (only paid once)
    let serviceFeePaid = totals?.serviceFeePaid || 0;
    let interestPaid = totals?.interestPaid || 0;
    const totalServiceFee = totals?.serviceFee || 0;
    const totalInterest = totals?.interest || 0;
    const totalTax = totals?.tax || 0;

    for (const inst of unpaidInstallments) {
      if (remaining <= 0) break;

      const instPrincipalRemaining = Math.max(
        0,
        (inst.amount || 0) - (inst.paidAmount || 0)
      );

      // Calculate penalty for this installment
      const penaltyDueDate = penaltyPerInstallment
        ? new Date(inst.dueDate)
        : new Date(loan?.dueDate || inst.dueDate);
      const instPenalty = calculateInstallmentPenalty({
        dueDate: penaltyDueDate,
        principalOutstanding: instPrincipalRemaining,
        penaltyRules,
        asOfDate,
      });

      // Service fee only on first installment
      const serviceFeeDue =
        inst.installmentNumber === 1
          ? Math.max(0, totalServiceFee - serviceFeePaid)
          : 0;
      const interestDue = Math.max(0, totalInterest - interestPaid);
      const taxDue =
        totalTax > 0 && interestDue + serviceFeeDue > 0
          ? (totalTax / (totalInterest + totalServiceFee)) *
            (interestDue + serviceFeeDue)
          : 0;

      // Allocate in priority order
      const penaltyPaid = Math.min(remaining, instPenalty);
      remaining -= penaltyPaid;

      const sfPaid = Math.min(remaining, serviceFeeDue);
      remaining -= sfPaid;
      serviceFeePaid += sfPaid;

      const intPaid = Math.min(remaining, interestDue);
      remaining -= intPaid;
      interestPaid += intPaid;

      const txPaid = Math.min(remaining, taxDue);
      remaining -= txPaid;

      const princPaid = Math.min(remaining, instPrincipalRemaining);
      remaining -= princPaid;

      const total = penaltyPaid + sfPaid + intPaid + txPaid + princPaid;

      if (total > 0) {
        allocations.push({
          installmentNumber: inst.installmentNumber,
          principal: Math.round(princPaid * 100) / 100,
          penalty: Math.round(penaltyPaid * 100) / 100,
          serviceFee: Math.round(sfPaid * 100) / 100,
          interest: Math.round(intPaid * 100) / 100,
          tax: Math.round(txPaid * 100) / 100,
          total: Math.round(total * 100) / 100,
        });
      }
    }

    return allocations.length > 0 ? allocations : null;
  }, [
    amount,
    isInstallmentPayment,
    unpaidInstallments,
    loan,
    taxConfigs,
    asOfDate,
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-2 flex-row justify-between items-center">
          <DialogTitle className="text-center text-xl flex-1">
            Set Amount
          </DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-primary/10"
              style={{ "--primary": providerColor } as React.CSSProperties}
            >
              <X className="h-5 w-5" style={{ color: providerColor }} />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="px-6 space-y-4">
          <div className="relative">
            <input
              type="text"
              readOnly
              value={amount}
              placeholder="0.00"
              className={cn(
                "w-full text-center text-4xl font-bold border-b-2 py-2 bg-transparent outline-none",
                error ? "border-destructive" : ""
              )}
              style={{
                borderColor: error ? "hsl(var(--destructive))" : providerColor,
              }}
            />
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground">
              ETB
            </span>
          </div>
          {error ? (
            <Alert variant="destructive" className="p-2 text-center">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="text-center text-sm text-muted-foreground space-y-2">
              {isInstallmentPayment && activeInstallment && (
                <div className="text-xs space-y-1">
                  <p className="font-medium">
                    Active: Installment {activeInstallment.installmentNumber} of{" "}
                    {unpaidInstallments.length +
                      ((loan as any)?.installments?.filter(
                        (i: any) => i.status === "Paid"
                      ).length || 0)}
                  </p>
                  <p className="text-muted-foreground">
                    Pay more than active installment to settle multiple
                    installments
                  </p>
                </div>
              )}

              {/* Allocation Preview */}
              {allocationPreview && allocationPreview.length > 0 && (
                <div className="text-xs text-left border rounded-md p-2 bg-muted/30 space-y-2">
                  <p className="font-semibold text-foreground">
                    Payment Allocation Preview:
                  </p>
                  {allocationPreview.map((alloc) => (
                    <div
                      key={alloc.installmentNumber}
                      className="border-l-2 pl-2 py-1"
                      style={{ borderColor: providerColor }}
                    >
                      <p className="font-medium text-foreground">
                        Installment {alloc.installmentNumber}:{" "}
                        {formatCurrency(alloc.total)}
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                        {alloc.penalty > 0 && (
                          <span>Penalty: {formatCurrency(alloc.penalty)}</span>
                        )}
                        {alloc.serviceFee > 0 && (
                          <span>
                            Service Fee: {formatCurrency(alloc.serviceFee)}
                          </span>
                        )}
                        {alloc.interest > 0 && (
                          <span>
                            Interest: {formatCurrency(alloc.interest)}
                          </span>
                        )}
                        {alloc.tax > 0 && (
                          <span>Tax: {formatCurrency(alloc.tax)}</span>
                        )}
                        {alloc.principal > 0 && (
                          <span>
                            Principal: {formatCurrency(alloc.principal)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total breakdown */}
              <div className="grid grid-cols-3 gap-2 text-xs text-left">
                <span className="col-span-2">Total Principal Due:</span>
                <span className="text-right font-medium text-foreground">
                  {formatCurrency(breakdown.principal)}
                </span>

                <span className="col-span-2">Service Fee Due:</span>
                <span className="text-right font-medium text-foreground">
                  {formatCurrency(breakdown.serviceFee)}
                </span>

                <span className="col-span-2">Interest Due:</span>
                <span className="text-right font-medium text-foreground">
                  {formatCurrency(breakdown.interest)}
                </span>

                <span className="col-span-2">Penalty Due:</span>
                <span className="text-right font-medium text-foreground">
                  {formatCurrency(breakdown.penalty)}
                </span>

                <span className="col-span-2">Tax Due:</span>
                <span className="text-right font-medium text-foreground">
                  {formatCurrency(breakdown.tax)}
                </span>
              </div>
              <p className="font-bold text-foreground">
                Total amount to be repaid: {formatCurrency(totalBalanceDue)}
              </p>
              <p>
                Remaining after this payment: {formatCurrency(remainingAmount)}
              </p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-px bg-border rounded-b-lg overflow-hidden mt-4">
          <div className="col-span-3 grid grid-cols-3 grid-rows-4 gap-px">
            {numberPadKeys.map((key) => (
              <Button
                key={key}
                variant="ghost"
                className="h-16 text-2xl rounded-none bg-background hover:bg-primary/10"
                onClick={() => handleNumberClick(key)}
                style={{ "--primary": providerColor } as React.CSSProperties}
              >
                {key}
              </Button>
            ))}
            <Button
              variant="ghost"
              className="h-16 text-2xl rounded-none bg-background col-span-2 hover:bg-primary/10"
              onClick={() => handleNumberClick("0")}
              style={{ "--primary": providerColor } as React.CSSProperties}
            >
              0
            </Button>
            <Button
              variant="ghost"
              className="h-16 text-2xl rounded-none bg-background hover:bg-primary/10"
              onClick={() => handleNumberClick(".")}
              style={{ "--primary": providerColor } as React.CSSProperties}
            >
              .
            </Button>
          </div>
          <div className="col-span-1 grid grid-rows-4 gap-px">
            <Button
              variant="ghost"
              className="h-16 text-2xl rounded-none bg-background flex items-center justify-center hover:bg-primary/10"
              onClick={handleBackspace}
              style={{ "--primary": providerColor } as React.CSSProperties}
            >
              <Delete className="h-7 w-7" />
            </Button>
            <Button
              className="h-full text-2xl rounded-none text-primary-foreground row-span-3"
              onClick={handleConfirm}
              disabled={!!error || isProcessing}
              style={{ backgroundColor: providerColor }}
            >
              {isProcessing ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                "OK"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
