
'use client';

import React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LoanDetails, LoanProvider, LoanProduct, Payment } from '@/lib/types';
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
import { recalculateScoreAndLoanLimit } from '@/actions/eligibility';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

interface DashboardClientProps {
  providers: LoanProvider[];
  initialLoanHistory: LoanDetails[];
}

export function DashboardClient({ providers, initialLoanHistory }: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerIdFromUrl = searchParams.get('providerId');
  const eligibilityError = searchParams.get('error');
  const customerId = searchParams.get('customerId');
  const { toast } = useToast();

  const [loanHistory, setLoanHistory] = useState(initialLoanHistory);
  const [selectedProviderId, setSelectedProviderId] = useState(providerIdFromUrl ?? providers[0]?.id);
  const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
  const [repayingLoan, setRepayingLoan] = useState<LoanDetails | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  const isEligible = !eligibilityError;

  const [currentMaxLoanLimit, setCurrentMaxLoanLimit] = useState(0);


  useEffect(() => {
    setLoanHistory(initialLoanHistory);
  }, [initialLoanHistory]);

  useEffect(() => {
    if (providers.length > 0 && customerId) {
      const providerIdToUse = providerIdFromUrl || providers[0]?.id;
      if (providerIdToUse) {
        handleProviderSelect(providerIdToUse, true);
      }
    }
  }, [providers, customerId, providerIdFromUrl]);

  
  const { totalBorrowed, availableToBorrow } = useMemo(() => {
    const unpaidLoans = loanHistory.filter(loan => loan.repaymentStatus === 'Unpaid');
    
    const totalBorrowed = unpaidLoans.reduce((acc, loan) => acc + loan.loanAmount, 0);
    const availableToBorrow = Math.max(0, currentMaxLoanLimit - totalBorrowed);

    return { totalBorrowed, availableToBorrow };
  }, [currentMaxLoanLimit, loanHistory]);

  const activeLoansByProduct = useMemo(() => {
      const unpaidLoans = loanHistory.filter(loan => loan.repaymentStatus === 'Unpaid');
      return unpaidLoans.reduce((acc, loan) => {
          if (!acc[loan.productName] || new Date(loan.dueDate) > new Date(acc[loan.productName].dueDate)) {
              acc[loan.productName] = loan;
          }
          return acc;
      }, {} as Record<string, LoanDetails>);
  }, [loanHistory]);


  const selectedProvider = useMemo(() => {
    return providers.find(p => p.id === selectedProviderId) || providers[0] || null;
  }, [selectedProviderId, providers]);

  const handleApply = (productId: string) => {
    if (!customerId) {
        toast({ title: 'Error', description: 'Customer ID not found.', variant: 'destructive'});
        return;
    }
    const params = new URLSearchParams();
    params.set('providerId', selectedProviderId);
    params.set('product', productId);
    params.set('customerId', customerId);
    params.set('max', String(currentMaxLoanLimit));
    router.push(`/apply?${params.toString()}`);
  }

  const handleProviderSelect = async (providerId: string, isInitialLoad = false) => {
    if (!customerId) {
      // Don't do anything if we don't have a customer context.
      return;
    }
    
    setIsRecalculating(true);
    setSelectedProviderId(providerId);

    const provider = providers.find(p => p.id === providerId);
    if (!provider || provider.products.length === 0) {
      setCurrentMaxLoanLimit(0);
      setIsRecalculating(false);
      return;
    }

    try {
      // For now, we check against the first product of the provider.
      // A more advanced implementation might check all products and take the highest limit.
      const firstProductId = provider.products[0].id;
      const { maxLoanAmount } = await recalculateScoreAndLoanLimit(Number(customerId), Number(providerId), Number(firstProductId));
      setCurrentMaxLoanLimit(maxLoanAmount);

    } catch (error) {
      console.error("Error recalculating score:", error);
      setCurrentMaxLoanLimit(0);
       toast({
        title: 'Calculation Error',
        description: "Could not calculate loan limit for this provider.",
        variant: 'destructive',
      });
    } finally {
      setIsRecalculating(false);
    }
    
    // Only update URL if it's not the initial load based on URL params
    if (!isInitialLoad) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('providerId', providerId);
      router.push(`/loan?${params.toString()}`, { scroll: false });
    }
  }
  
  const handleRepay = (loan: LoanDetails) => {
    // Find the full product details to pass to the dialog
    const productForLoan = selectedProvider?.products.find(p => p.name === loan.productName);
    if (productForLoan) {
        setRepayingLoan({ ...loan, product: productForLoan });
        setIsRepayDialogOpen(true);
    } else {
        toast({ title: 'Error', description: 'Could not find product details for this loan.', variant: 'destructive' });
    }
  }

  const handleConfirmRepayment = async (amount: number) => {
    if (!repayingLoan) return;
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId: repayingLoan.id, amount }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process payment.');
      }
      
      const updatedLoan = await response.json();

      // Update the loan history state with the updated loan
      setLoanHistory(prevHistory => 
        prevHistory.map(l => l.id === updatedLoan.id ? updatedLoan : l)
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
      setRepayingLoan(null);
    }
  }

  const handleBack = () => {
    router.push('/check-eligibility/select-customer');
  }
  
  const getProviderForLoan = (loan: LoanDetails) => providers.find(p => p.name === loan.providerName);


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

                  {!isEligible && (
                     <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Not Eligible for a Loan</AlertTitle>
                      <AlertDescription>{eligibilityError}</AlertDescription>
                    </Alert>
                  )}

                  {isEligible && (
                    <LoanSummaryCard
                        maxLoanLimit={currentMaxLoanLimit}
                        availableToBorrow={availableToBorrow}
                        color={selectedProvider?.colorHex}
                        isLoading={isRecalculating}
                    />
                  )}
              
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
                                        .map((product) => (
                                        <ProductCard 
                                            key={product.id}
                                            product={{
                                                ...product,
                                                availableLimit: Math.min(product.maxLoan || 0, availableToBorrow)
                                            }}
                                            providerColor={selectedProvider.colorHex}
                                            activeLoan={activeLoansByProduct[product.name]}
                                            onApply={() => handleApply(product.id)}
                                            onRepay={handleRepay}
                                            IconDisplayComponent={IconDisplay}
                                        />
                                    ))}
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
      {repayingLoan && (
        <RepaymentDialog
            isOpen={isRepayDialogOpen}
            onClose={() => setIsRepayDialogOpen(false)}
            onConfirm={handleConfirmRepayment}
            loan={repayingLoan}
            providerColor={selectedProvider?.colorHex}
        />
      )}
    </>
  );
}
