
'use client';

import React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LoanDetails, LoanProvider, LoanProduct, Payment, FeeRule, PenaltyRule } from '@/lib/types';
import { Logo, IconDisplay } from '@/components/icons';
import { format, differenceInDays } from 'date-fns';
import { CreditCard, Wallet, ChevronDown, ArrowLeft, ChevronRight, AlertCircle, ChevronUp, Loader2, History } from 'lucide-react';
import { LoanSummaryCard } from '@/components/loan/loan-summary-card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ProductCard } from '@/components/loan/product-card';
import { RepaymentDialog } from '@/components/loan/repayment-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { checkLoanEligibility } from '@/actions/eligibility';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'decimal' }).format(amount) + ' ETB';
};

interface DashboardClientProps {
  providers: LoanProvider[];
  initialLoanHistory: LoanDetails[];
}

interface EligibilityState {
    limits: Record<string, number>;
    reasons: Record<string, string>;
}

export function DashboardClient({ providers, initialLoanHistory }: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerIdFromUrl = searchParams.get('providerId');
  const borrowerId = searchParams.get('borrowerId');
  const { toast } = useToast();

  const [loanHistory, setLoanHistory] = useState(initialLoanHistory);
  const [selectedProviderId, setSelectedProviderId] = useState(providerIdFromUrl ?? providers[0]?.id);
  const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
  const [repayingLoanInfo, setRepayingLoanInfo] = useState<{ loan: LoanDetails, balanceDue: number } | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityState>({ limits: {}, reasons: {} });

  
  const recalculateEligibility = useCallback(async (providerId: string) => {
    if (!borrowerId) return;

    setIsRecalculating(true);
    const provider = providers.find(p => p.id === providerId);
    if (!provider) {
        setIsRecalculating(false);
        return;
    }

    try {
        const newLimits: Record<string, number> = {};
        const newReasons: Record<string, string> = {};

        for (const product of provider.products) {
            const { isEligible, reason, maxLoanAmount } = await checkLoanEligibility(borrowerId, providerId, product.id);
            newLimits[product.id] = isEligible ? maxLoanAmount : 0;
            newReasons[product.id] = reason;
        }

        setEligibility({ limits: newLimits, reasons: newReasons });

    } catch (error) {
        console.error("Error recalculating eligibility:", error);
        const defaultReason = "Could not calculate loan eligibility for this provider.";
        const newReasons = provider.products.reduce((acc, p) => ({ ...acc, [p.id]: defaultReason }), {});
        setEligibility({ limits: {}, reasons: newReasons });
        toast({
            title: 'Calculation Error',
            description: defaultReason,
            variant: 'destructive',
        });
    } finally {
        setIsRecalculating(false);
    }
  }, [borrowerId, providers, toast]);


  useEffect(() => {
    setLoanHistory(initialLoanHistory);
  }, [initialLoanHistory]);

  useEffect(() => {
    if (providers.length > 0 && borrowerId) {
      const providerIdToUse = providerIdFromUrl || providers[0]?.id;
      if (providerIdToUse) {
        setSelectedProviderId(providerIdToUse);
        if (Object.keys(eligibility.limits).length === 0) { // Only run on initial load
          recalculateEligibility(providerIdToUse);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers, borrowerId, providerIdFromUrl]);

  const { overallMaxLimit, totalBorrowed, availableToBorrow } = useMemo(() => {
    const overallMaxLimit = Object.values(eligibility.limits).reduce((max, limit) => Math.max(max, limit), 0);
    const unpaidLoans = loanHistory.filter(loan => loan.repaymentStatus === 'Unpaid');
    const totalBorrowed = unpaidLoans.reduce((acc, loan) => acc + loan.loanAmount, 0);
    const availableToBorrow = Math.max(0, overallMaxLimit - totalBorrowed);
    return { overallMaxLimit, totalBorrowed, availableToBorrow };
  }, [eligibility.limits, loanHistory]);


  const activeLoansByProduct = useMemo(() => {
      const unpaidLoans = loanHistory.filter(loan => loan.repaymentStatus === 'Unpaid');
      return unpaidLoans.reduce((acc, loan) => {
          if (!acc[loan.product.id] || new Date(loan.dueDate) > new Date(acc[loan.product.id].dueDate)) {
              acc[loan.product.id] = loan;
          }
          return acc;
      }, {} as Record<string, LoanDetails>);
  }, [loanHistory]);


  const selectedProvider = useMemo(() => {
    return providers.find(p => p.id === selectedProviderId) || providers[0] || null;
  }, [selectedProviderId, providers]);

  const handleApply = (productId: string) => {
    if (!borrowerId) {
        toast({ title: 'Error', description: 'Borrower ID not found.', variant: 'destructive'});
        return;
    }
    const productLimit = eligibility.limits[productId] ?? 0;
    
    // The true max loan is the lesser of the product's individual limit and the overall available limit.
    const trueMaxLoan = Math.min(productLimit, availableToBorrow);

    const params = new URLSearchParams(searchParams.toString());
    params.set('providerId', selectedProviderId);
    params.set('product', productId);
    params.set('max', String(trueMaxLoan));
    params.set('step', 'calculator');
    router.push(`/apply?${params.toString()}`);
  }
  
   const handleProviderSelect = (providerId: string) => {
    setSelectedProviderId(providerId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('providerId', providerId);
    router.push(`/loan?${params.toString()}`, { scroll: false });
    recalculateEligibility(providerId);
  }
  
  const handleRepay = (loan: LoanDetails, balanceDue: number) => {
    setRepayingLoanInfo({ loan, balanceDue });
    setIsRepayDialogOpen(true);
  }

  const handleConfirmRepayment = async (amount: number) => {
    if (!repayingLoanInfo) return;
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId: repayingLoanInfo.loan.id, amount }),
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

      // Re-check eligibility after repayment
      if (selectedProviderId) {
        recalculateEligibility(selectedProviderId);
      }

      toast({
        title: 'Payment Successful',
        description: `${formatCurrency(amount)} has been paid towards your loan.`,
      });

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

  const handleBack = () => {
    router.push('/check-eligibility/select-customer');
  }
  
  return (
    <>
      <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-40 w-full border-b" style={{ backgroundColor: selectedProvider?.colorHex || '#fdb913' }}>
          <div className="container flex h-16 items-center">
            <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2 text-primary-foreground hover:bg-white/20">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
               <h1 className="text-lg font-semibold tracking-tight text-primary-foreground">
                  NIBTera Loan
              </h1>
            </div>
             <div className="ml-auto">
             </div>
          </div>
        </header>
        <main className="flex-1">
          <div className="container py-4 md:py-6">
              <div className="flex flex-col">
                  <div className="py-2">
                      <div className="flex justify-center space-x-4 overflow-x-auto">
                          {providers.map((provider) => (
                              <div key={provider.id} onClick={() => handleProviderSelect(provider.id)} className="flex flex-col items-center space-y-2 cursor-pointer flex-shrink-0">
                                  <div 
                                      className={cn(
                                          "h-20 w-20 rounded-full flex items-center justify-center border-2 transition-all",
                                          selectedProviderId === provider.id ? `border-current` : 'border-transparent'
                                      )}
                                      style={{ color: selectedProviderId === provider.id ? provider.colorHex : 'transparent' }}
                                  >
                                      <div className={cn("h-16 w-16 rounded-full bg-card flex items-center justify-center transition-all shadow-md hover:shadow-lg", selectedProviderId === provider.id ? 'shadow-lg' : '')}>
                                          {isRecalculating && selectedProviderId === provider.id ? <Loader2 className="h-8 w-8 animate-spin" /> : <IconDisplay iconName={provider.icon} className="h-8 w-8 text-muted-foreground" />}
                                      </div>
                                  </div>
                                  <span className={cn(
                                      "text-sm font-medium",
                                      selectedProviderId === provider.id ? '' : 'text-muted-foreground'
                                  )} style={{ color: selectedProviderId === provider.id ? provider.colorHex : '' }}>{provider.name}</span>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="mt-2">
                    <LoanSummaryCard
                        maxLoanLimit={overallMaxLimit}
                        availableToBorrow={availableToBorrow}
                        color={selectedProvider?.colorHex}
                        isLoading={isRecalculating}
                    />
                  </div>
              
                  <div className="flex justify-end mt-4">
                    <Link
                        href={`/history?${searchParams.toString()}`}
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
                        style={{ backgroundColor: selectedProvider ? `${selectedProvider.colorHex}20` : '#fdb91320', color: selectedProvider?.colorHex || '#fdb913' }}
                    >
                        <span>Loan History</span>
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                  
                  <div className="grid gap-8 grid-cols-1 mt-4">
                      <div className="md:col-span-2">
                        {selectedProvider && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Available Loan Products</CardTitle>
                                    <CardDescription>Select a product from {selectedProvider.name} to apply.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {selectedProvider.products
                                        .filter(p => p.status === 'Active')
                                        .map((product) => {
                                            const productLimit = eligibility.limits[product.id] ?? 0;
                                            const isEligible = productLimit > 0;
                                            const reason = eligibility.reasons[product.id] || '';
                                            
                                            return (
                                                <ProductCard 
                                                    key={product.id}
                                                    product={{
                                                        ...product,
                                                        availableLimit: productLimit,
                                                    }}
                                                    providerColor={selectedProvider.colorHex}
                                                    activeLoan={activeLoansByProduct[product.id]}
                                                    onApply={() => handleApply(product.id)}
                                                    onRepay={handleRepay}
                                                    IconDisplayComponent={IconDisplay}
                                                    isEligible={isEligible}
                                                    eligibilityReason={reason}
                                                />
                                            )
                                        })}
                                    {selectedProvider.products.filter(p => p.status === 'Active').length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-8">No active loan products available from this provider.</p>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                      </div>
                  </div>
              </div>
          </div>
        </main>
      </div>
      {repayingLoanInfo && (
        <RepaymentDialog
            isOpen={isRepayDialogOpen}
            onClose={() => setIsRepayDialogOpen(false)}
            onConfirm={handleConfirmRepayment}
            loan={repayingLoanInfo.loan}
            totalBalanceDue={repayingLoanInfo.balanceDue}
            providerColor={selectedProvider?.colorHex}
        />
      )}
    </>
  );
}
