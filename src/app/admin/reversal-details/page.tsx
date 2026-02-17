"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useRequirePermission } from "@/hooks/use-require-permission";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "0.00";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

interface ReversalDetailsData {
  loan: {
    id: string;
    borrowerId: string;
    borrowerPhone: string;
    accountNumber: string | null;
    loanAmount: number;
    serviceFee: number;
    penaltyAmount: number;
    disbursedDate: string;
    dueDate: string;
    repaymentStatus: string;
    repaidAmount: number;
    providerName: string;
    productName: string;
  };
  reversal: {
    reversedAt: string;
    reversedBy: string;
    reversedByEmail: string | null;
  } | null;
  approval: {
    requestedAt: string;
    requestedBy: string;
    requestedByEmail: string | null;
    approvedAt: string | null;
    approvedBy: string | null;
    approvedByEmail: string | null;
    rejectionReason: string | null;
  } | null;
  paymentActivity: {
    hasPaymentActivity: boolean;
    totalRepaidAmount: number;
    reversedPayments: Array<{
      id: string;
      amount: number;
      date: string;
      installmentId: string | null;
      journalEntryId: string | null;
    }>;
    reversedInstallments: Array<{
      id: string;
      installmentNumber: number;
      amount: number;
      paidAmount: number;
      status: string;
    }>;
  };
}

export default function ReversalDetailsPage() {
  useRequirePermission("reversals");

  const router = useRouter();
  const searchParams = useSearchParams();
  const loanId = searchParams?.get("loanId") ?? null;
  const { toast } = useToast();

  const [data, setData] = useState<ReversalDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loanId) {
      setIsLoading(false);
      return;
    }

    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/reversals/details?loanId=${encodeURIComponent(loanId)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || "Failed to fetch reversal details");
        }
        const result = await res.json();
        setData(result);
      } catch (e: any) {
        toast({
          title: "Error",
          description: String(e?.message ?? e),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void fetchDetails();
  }, [loanId, toast]);

  if (!loanId) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <p className="text-muted-foreground">No loan ID provided.</p>
        <Button variant="outline" onClick={() => router.push("/admin/reversals")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reversals
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <p className="text-red-500">Could not load reversal details.</p>
        <Button variant="outline" onClick={() => router.push("/admin/reversals")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reversals
        </Button>
      </div>
    );
  }

  const { loan, reversal, approval, paymentActivity } = data;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/reversals")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reversal Details</h2>
          <p className="text-muted-foreground">
            Detailed view of the reversed loan and associated repayment activity.
          </p>
        </div>
      </div>

      {/* Reversal Status Banner */}
      {reversal ? (
        <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-red-800 dark:text-red-200">
              Loan Reversed
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300">
              This loan was reversed on{" "}
              <strong>{format(new Date(reversal.reversedAt), "PPpp")}</strong>
              {paymentActivity.hasPaymentActivity && (
                <span>
                  {" "}— <strong>{formatCurrency(paymentActivity.totalRepaidAmount)} ETB</strong> in repayment activity was also reversed.
                </span>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
              No Reversal Record Found
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              This loan has not been reversed yet, or the reversal log was not found.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Loan Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Loan Information</CardTitle>
            <CardDescription>Original loan details</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Loan ID</dt>
                <dd className="text-sm font-mono">{loan.id}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Borrower</dt>
                <dd className="text-sm font-mono">{loan.borrowerPhone}</dd>
              </div>
              {loan.accountNumber && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Account Number</dt>
                    <dd className="text-sm font-mono">{loan.accountNumber}</dd>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Provider</dt>
                <dd className="text-sm">{loan.providerName}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Product</dt>
                <dd className="text-sm">{loan.productName}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Loan Amount</dt>
                <dd className="text-sm font-semibold">{formatCurrency(loan.loanAmount)} ETB</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Service Fee</dt>
                <dd className="text-sm">{formatCurrency(loan.serviceFee)} ETB</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Disbursed Date</dt>
                <dd className="text-sm">{format(new Date(loan.disbursedDate), "PPP")}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Due Date</dt>
                <dd className="text-sm">{format(new Date(loan.dueDate), "PPP")}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <Badge
                    className={
                      loan.repaymentStatus === "REVERSED"
                        ? "bg-red-600 text-white"
                        : loan.repaymentStatus === "Paid"
                        ? "bg-green-600 text-white"
                        : "bg-yellow-600 text-white"
                    }
                  >
                    {loan.repaymentStatus}
                  </Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Reversal & Approval Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reversal Timeline</CardTitle>
            <CardDescription>Who reversed and approved this transaction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Requested */}
              {approval && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">1</span>
                    </div>
                    <div className="w-px h-full bg-border mt-1" />
                  </div>
                  <div className="pb-6">
                    <p className="text-sm font-semibold">Reversal Requested</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(approval.requestedAt), "PPpp")}
                    </p>
                    <p className="text-sm mt-1">
                      By: <span className="font-medium">{approval.requestedBy}</span>
                      {approval.requestedByEmail && (
                        <span className="text-muted-foreground"> ({approval.requestedByEmail})</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Approved */}
              {approval?.approvedAt && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="w-px h-full bg-border mt-1" />
                  </div>
                  <div className="pb-6">
                    <p className="text-sm font-semibold">Approved</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(approval.approvedAt), "PPpp")}
                    </p>
                    <p className="text-sm mt-1">
                      By: <span className="font-medium">{approval.approvedBy}</span>
                      {approval.approvedByEmail && (
                        <span className="text-muted-foreground"> ({approval.approvedByEmail})</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Reversed */}
              {reversal && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Reversal Executed</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(reversal.reversedAt), "PPpp")}
                    </p>
                    <p className="text-sm mt-1">
                      By: <span className="font-medium">{reversal.reversedBy}</span>
                      {reversal.reversedByEmail && (
                        <span className="text-muted-foreground"> ({reversal.reversedByEmail})</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {!approval && !reversal && (
                <p className="text-sm text-muted-foreground">
                  No reversal timeline information available.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Activity Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Reversed Repayment Activity
            {paymentActivity.hasPaymentActivity ? (
              <Badge className="bg-amber-600 text-white">
                {paymentActivity.reversedPayments.length} payment{paymentActivity.reversedPayments.length !== 1 ? "s" : ""} reversed
              </Badge>
            ) : (
              <Badge variant="outline">No repayment activity</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {paymentActivity.hasPaymentActivity
              ? `A total of ${formatCurrency(paymentActivity.totalRepaidAmount)} ETB in repayments was reversed along with this loan.`
              : "This loan had no repayment activity at the time of reversal."}
          </CardDescription>
        </CardHeader>
        {paymentActivity.hasPaymentActivity && (
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md border p-4 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(paymentActivity.totalRepaidAmount)}
                </p>
                <p className="text-xs text-muted-foreground">Total Repaid (ETB)</p>
              </div>
              <div className="rounded-md border p-4 text-center">
                <p className="text-2xl font-bold">
                  {paymentActivity.reversedPayments.length}
                </p>
                <p className="text-xs text-muted-foreground">Payments Reversed</p>
              </div>
              <div className="rounded-md border p-4 text-center">
                <p className="text-2xl font-bold">
                  {paymentActivity.reversedInstallments.filter((i) => (i.paidAmount || 0) > 0).length}
                </p>
                <p className="text-xs text-muted-foreground">Installments Affected</p>
              </div>
            </div>

            {/* Payment Records Table */}
            {paymentActivity.reversedPayments.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Payment Records</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Installment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentActivity.reversedPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-xs">
                          {payment.id}
                        </TableCell>
                        <TableCell>
                          {payment.date
                            ? format(new Date(payment.date), "PPpp")
                            : "—"}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(payment.amount)} ETB
                        </TableCell>
                        <TableCell>
                          {payment.installmentId ? (
                            <span className="font-mono text-xs">{payment.installmentId}</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Installment Records Table */}
            {paymentActivity.reversedInstallments.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Installment Status (at time of reversal)</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Installment Amount</TableHead>
                      <TableHead>Paid Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentActivity.reversedInstallments.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell>{inst.installmentNumber}</TableCell>
                        <TableCell>{formatCurrency(inst.amount)} ETB</TableCell>
                        <TableCell
                          className={
                            (inst.paidAmount || 0) > 0
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : ""
                          }
                        >
                          {formatCurrency(inst.paidAmount)} ETB
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              inst.status === "PAID"
                                ? "border-green-500 text-green-600"
                                : inst.status === "LATE"
                                ? "border-red-500 text-red-600"
                                : ""
                            }
                          >
                            {inst.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
