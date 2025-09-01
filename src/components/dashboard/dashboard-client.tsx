
'use client';

import React from 'react';
import { useState, useMemo, useEffect } from 'react';
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
  const [eligibility, setEligibility] = useState<{isEligible: boolean, reason: string, limits: Record<string, number>}>({ isEligible: true, reason: '', limits: {} });

  useEffect(() => {
    setLoanHistory(initialLoanHistory);
  }, [initialLoanHistory]);

  useEffect(() => {
    if (providers.length > 0 && borrowerId) {
      const providerIdToUse = providerIdFromUrl || providers[0]?.id;
      if (providerIdToUse) {
        handleProviderSelect(providerIdToUse, true);
      }
    }
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

    const params = new URLSearchParams(searchParams.toString());
    params.set('providerId', selectedProviderId);
    params.set('product', productId);
    params.set('max', String(productLimit));
    params.set('step', 'calculator');
    router.push(`/apply?${params.toString()}`);
  }

  const handleProviderSelect = async (providerId: string, isInitialLoad = false) => {
    if (!borrowerId) {
      return;
    }
    
    setIsRecalculating(true);
    setSelectedProviderId(providerId);

    const provider = providers.find(p => p.id === providerId);
    if (!provider) {
      setIsRecalculating(false);
      return;
    }

    try {
        const productLimits: Record<string, number> = {};
        let finalEligibility = { isEligible: true, reason: ''};

        for (const product of provider.products) {
            const { isEligible, reason, score, maxLoanAmount } = await checkLoanEligibility(borrowerId, providerId, product.id);
            if (!isEligible) {
                // If any product check makes the user ineligible for the whole provider, we can store that.
                // For now, we assume ineligibility is per-product, but this could be changed.
                finalEligibility = { isEligible: false, reason };
            }
            productLimits[product.id] = maxLoanAmount;
        }
        setEligibility({ isEligible: finalEligibility.isEligible, reason: finalEligibility.reason, limits: productLimits });

    } catch (error) {
      console.error("Error recalculating score:", error);
      setEligibility({ isEligible: false, reason: 'Could not calculate loan limit for this provider.', limits: {} });
       toast({
        title: 'Calculation Error',
        description: "Could not calculate loan limit for this provider.",
        variant: 'destructive',
      });
    } finally {
      setIsRecalculating(false);
    }
    
    if (!isInitialLoad) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('providerId', providerId);
      router.push(`/loan?${params.toString()}`, { scroll: false });
    }
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
                  {selectedProvider ? `${selectedProvider.name} Dashboard` : 'Loan Dashboard'}
              </h1>
            </div>
             <div className="ml-auto">
             </div>
          </div>
        </header>
        <main className="flex-1">
          <div className="container py-8 md:py-12">
              <div className="flex flex-col space-y-8">
                  <div>
                      <div className="flex justify-center space-x-4 overflow-x-auto pb-4">
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

                  <LoanSummaryCard
                      maxLoanLimit={overallMaxLimit}
                      availableToBorrow={availableToBorrow}
                      color={selectedProvider?.colorHex}
                      isLoading={isRecalculating}
                  />
              
                  <div className="flex justify-end">
                    <Link
                        href={`/history?${searchParams.toString()}`}
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
                        style={{ backgroundColor: selectedProvider ? `${selectedProvider.colorHex}20` : '#fdb91320', color: selectedProvider?.colorHex || '#fdb913' }}
                    >
                        <span>Loan History</span>
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                  
                  <div className="grid gap-8 grid-cols-1">
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
                                            const availableForProduct = Math.min(productLimit, availableToBorrow);
                                            
                                            return (
                                                <ProductCard 
                                                    key={product.id}
                                                    product={{
                                                        ...product,
                                                        availableLimit: availableForProduct,
                                                    }}
                                                    providerColor={selectedProvider.colorHex}
                                                    activeLoan={activeLoansByProduct[product.id]}
                                                    onApply={() => handleApply(product.id)}
                                                    onRepay={handleRepay}
                                                    IconDisplayComponent={IconDisplay}
                                                    eligibilityReason={eligibility.isEligible ? '' : eligibility.reason}
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
