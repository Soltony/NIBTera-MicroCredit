
'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LoanDetails, LoanProvider, Tax } from '@/lib/types';
import { format } from 'date-fns';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { RepaymentDialog } from '@/components/loan/repayment-dialog';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return '0.00';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};


interface HistoryClientProps {
  initialLoanHistory: LoanDetails[];
  providers: LoanProvider[];
  taxConfigs: Tax[];
  asOfDate: Date;
}

export function HistoryClient({ initialLoanHistory, providers, taxConfigs, asOfDate }: HistoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [loanHistory, setLoanHistory] = useState(initialLoanHistory);
  const [activeTab, setActiveTab] = useState('active');
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
  const [repayingLoanInfo, setRepayingLoanInfo] = useState<{ loan: LoanDetails, balanceDue: number, installmentId?: string } | null>(null);
  const [selectedLoanProviderColor, setSelectedLoanProviderColor] = useState<string>('#fdb913');
  const [pendingPaymentLoanIds, setPendingPaymentLoanIds] = useState<Set<string>>(new Set());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load pending payments from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem('pendingPayments');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Filter out stale pending payments (older than 10 minutes)
        const now = Date.now();
        const validIds = Object.keys(parsed).filter(
          (loanId) => now - parsed[loanId].initiatedAt < 10 * 60 * 1000
        );
        setPendingPaymentLoanIds(new Set(validIds));
        // Clean up stale entries
        const cleaned = validIds.reduce((acc, id) => ({ ...acc, [id]: parsed[id] }), {});
        sessionStorage.setItem('pendingPayments', JSON.stringify(cleaned));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    setLoanHistory(initialLoanHistory);
  }, [initialLoanHistory]);

  const handleBack = () => {
    router.push(`/loan?${searchParams.toString()}`)
  }
  
  const handleViewDetails = (loanId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    router.push(`/history/${loanId}?${params.toString()}`);
  }

  const { activeLoans, closedLoans } = useMemo(() => {
    const active = loanHistory.filter(loan => loan.repaymentStatus === 'Unpaid');
    const closed = loanHistory.filter(loan => loan.repaymentStatus === 'Paid');
    return { activeLoans: active, closedLoans: closed };
  }, [loanHistory]);

  const totalOutstanding = useMemo(() => {
    return activeLoans.reduce((acc, loan) => {
      const balance = loan.totalRepayableAmount ?? 0;
      return acc + Math.max(0, balance - (loan.repaidAmount || 0));
    }, 0);
  }, [activeLoans]);
  
  const totalCreditAmount = useMemo(() => {
    return loanHistory.reduce((acc, loan) => {
      if (loan.repaymentStatus === 'REVERSED') return acc;
      return acc + loan.loanAmount;
    }, 0);
  }, [loanHistory]);
  
  const totalRepaidAmount = useMemo(() => {
    return loanHistory.reduce((acc, loan) => acc + (loan.repaidAmount || 0), 0);
  }, [loanHistory]);
  
  const handleToggleExpand = (loanId: string) => {
      const newExpandedLoanId = expandedLoan === loanId ? null : loanId;
      setExpandedLoan(newExpandedLoanId);
      if (newExpandedLoanId) {
          const loan = loanHistory.find(l => l.id === newExpandedLoanId);
          const provider = providers.find(p => p.id === loan?.product.providerId);
          setSelectedLoanProviderColor(provider?.colorHex || '#fdb913');
      } else {
          // Reset to default or first loan's color when all are collapsed
           const firstLoanProvider = providers.find(p => p.id === loanHistory[0]?.product.providerId);
           setSelectedLoanProviderColor(firstLoanProvider?.colorHex || '#fdb913');
      }
  }


  const handleRepay = (loan: LoanDetails) => {
    // If the loan has an active installment, default to that installment amount (plus penalty)
    const activeInstallment = Array.isArray(loan.installments) ? loan.installments.find(i => i.isActive) : undefined;
    if (activeInstallment) {
      const installBalance = Math.max(0, (activeInstallment.amount - (activeInstallment.paidAmount || 0)) + (activeInstallment.penaltyAmount || 0));
      setRepayingLoanInfo({ loan, balanceDue: installBalance, installmentId: activeInstallment.id });
      setIsRepayDialogOpen(true);
      return;
    }

    const balanceDue = (loan.totalRepayableAmount ?? 0) - (loan.repaidAmount || 0);
    setRepayingLoanInfo({ loan, balanceDue: Math.max(0, balanceDue) });
    setIsRepayDialogOpen(true);
  }

  const handleConfirmRepayment = async (amount: number) => {
    if (!repayingLoanInfo) return;
    try {
      const payload: any = { loanId: repayingLoanInfo.loan.id, amount };
      if (repayingLoanInfo.installmentId) payload.installmentId = repayingLoanInfo.installmentId;
      const response = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process payment.');
      }
      
      const updatedLoanData = await response.json();

      const finalLoanObject: LoanDetails = {
        ...updatedLoanData,
        providerName: repayingLoanInfo.loan.providerName,
        productName: repayingLoanInfo.loan.productName,
        product: repayingLoanInfo.loan.product,
        provider: repayingLoanInfo.loan.provider,
        disbursedDate: new Date(updatedLoanData.disbursedDate),
        dueDate: new Date(updatedLoanData.dueDate),
        payments: updatedLoanData.payments,
      };

      setLoanHistory(prevHistory => 
        prevHistory.map(l => l.id === updatedLoanData.id ? finalLoanObject : l)
      );

      toast({
        title: 'Payment Successful',
        description: `${formatCurrency(amount)} ETB has been paid towards your loan.`,
      });

      try {
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('payment:completed', { detail: { loanId: updatedLoanData.id } });
          window.dispatchEvent(event);
          try {
            const bc = new BroadcastChannel('payments');
            bc.postMessage({ loanId: updatedLoanData.id });
            bc.close();
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore
      }

    } catch (error: any) {
       toast({
        title: 'Payment Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRepayDialogOpen(false);
      setRepayingLoanInfo(null);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Start polling when there are pending payments
    const startPolling = () => {
      if (pollingIntervalRef.current) return; // Already polling
      pollingIntervalRef.current = setInterval(() => {
        router.refresh();
      }, 5000); // Poll every 5 seconds
    };

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    // Check if we should be polling
    if (pendingPaymentLoanIds.size > 0) {
      startPolling();
    }

    const onPaymentInitiated = (e: CustomEvent<{ loanId: string; transactionId: string }>) => {
      setPendingPaymentLoanIds((prev) => new Set(prev).add(e.detail.loanId));
      startPolling();
    };

    const onPaymentCompleted = (e: CustomEvent<{ loanId: string }>) => {
      setPendingPaymentLoanIds((prev) => {
        const next = new Set(prev);
        next.delete(e.detail.loanId);
        return next;
      });
      // Clear from sessionStorage
      try {
        const stored = sessionStorage.getItem('pendingPayments');
        if (stored) {
          const parsed = JSON.parse(stored);
          delete parsed[e.detail.loanId];
          sessionStorage.setItem('pendingPayments', JSON.stringify(parsed));
        }
      } catch (err) {
        // ignore
      }
      // Refresh the page data
      router.refresh();
    };

    const onPayment = () => {
      // Clear all pending states and refresh
      setPendingPaymentLoanIds(new Set());
      try {
        sessionStorage.removeItem('pendingPayments');
      } catch (e) {
        // ignore
      }
      router.refresh();
    };

    window.addEventListener('payment:initiated', onPaymentInitiated as EventListener);
    window.addEventListener('payment:completed', onPaymentCompleted as EventListener);
    
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('payments');
      bc.addEventListener('message', onPayment as EventListener);
    } catch (e) {
      // ignore
    }

    return () => {
      stopPolling();
      window.removeEventListener('payment:initiated', onPaymentInitiated as EventListener);
      window.removeEventListener('payment:completed', onPaymentCompleted as EventListener);
      try { bc?.close(); } catch (e) { }
    };
  }, [pendingPaymentLoanIds.size, router]);


  const renderLoanCard = (loan: LoanDetails) => {
    const balanceDue = (loan.totalRepayableAmount ?? 0) - (loan.repaidAmount || 0);
    const provider = providers.find(p => p.id === loan.product.providerId);
    const color = provider?.colorHex || '#fdb913';
    const isPending = pendingPaymentLoanIds.has(loan.id);

    return (
      <Card 
        key={loan.id} 
        className="shadow-md transition-all" 
        style={{ borderLeft: `4px solid ${color}`}}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-gray-800">{loan.productName}</p>
              <p className="text-lg font-bold" style={{color: color}}>{formatCurrency(balanceDue > 0 ? balanceDue : loan.loanAmount)} <span className="text-sm font-normal text-muted-foreground">(ETB)</span></p>
              <p className="text-xs text-muted-foreground">{loan.id}</p>
              {isPending && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Payment processing...
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleViewDetails(loan.id)}>View</Button>
              {loan.repaymentStatus === 'Unpaid' && (
                <Button 
                  size="sm" 
                  style={{backgroundColor: isPending ? '#9ca3af' : color}} 
                  className="text-white" 
                  onClick={() => handleRepay(loan)}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Repay'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
        <main className="flex-1">
            <div className="container py-6 md:py-10">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-gray-200">
                        <TabsTrigger value="active">Active</TabsTrigger>
                        <TabsTrigger value="closed">Closed</TabsTrigger>
                    </TabsList>
                    
                    <div className="my-6">
                      {activeTab === 'active' ? (
                          <Card className="shadow-lg text-white transition-colors duration-300" style={{ backgroundColor: selectedLoanProviderColor }}>
                            <CardContent className="p-4 flex justify-around items-center">
                              <div className="text-center">
                                <p className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</p>
                                <p className="text-xs opacity-90">Total Outstanding Amount (ETB)</p>
                              </div>
                               <div className="text-center">
                                <p className="text-2xl font-bold">{formatCurrency(totalCreditAmount)}</p>
                                <p className="text-xs opacity-90">Total Credit Amount (ETB)</p>
                              </div>
                            </CardContent>
                          </Card>
                      ) : (
                          <Card className="shadow-lg text-white transition-colors duration-300" style={{ backgroundColor: selectedLoanProviderColor }}>
                            <CardContent className="p-4 flex justify-around items-center">
                              <div className="text-center">
                                <p className="text-2xl font-bold">{formatCurrency(totalRepaidAmount)}</p>
                                <p className="text-xs opacity-90">Total Amount Repaid (ETB)</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold">{closedLoans.length}</p>
                                <p className="text-xs opacity-90">Total Loans Closed</p>
                              </div>
                            </CardContent>
                          </Card>
                      )}
                    </div>
                    
                    <TabsContent value="active">
                       <div className="space-y-4">
                           {activeLoans.length > 0 ? activeLoans.map(renderLoanCard) : <p className="text-center text-muted-foreground py-8">No active loans.</p>}
                       </div>
                    </TabsContent>
                    <TabsContent value="closed">
                       <div className="space-y-4">
                           {closedLoans.length > 0 ? closedLoans.map(renderLoanCard) : <p className="text-center text-muted-foreground py-8">No closed loans.</p>}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </main>
        {repayingLoanInfo && (
            <RepaymentDialog
                isOpen={isRepayDialogOpen}
                onClose={() => setIsRepayDialogOpen(false)}
                onConfirm={handleConfirmRepayment}
                loan={repayingLoanInfo.loan}
                totalBalanceDue={repayingLoanInfo.balanceDue}
                providerColor={providers.find(p => p.id === repayingLoanInfo.loan.product.providerId)?.colorHex}
                taxConfigs={taxConfigs}
                asOfDate={asOfDate}
            />
        )}
    </div>
  );
}
