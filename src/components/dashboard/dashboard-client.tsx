
'use client';

import React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LoanDetails, LoanProvider, LoanProduct, Payment } from '@/lib/types';
import { Logo } from '@/components/icons';
import { format, differenceInDays } from 'date-fns';
import { Building2, Landmark, Briefcase, Home, PersonStanding, CreditCard, Wallet, ChevronDown, ArrowLeft, ChevronRight, AlertCircle, ChevronUp, Loader2 } from 'lucide-react';
import { LoanSummaryCard } from '@/components/loan/loan-summary-card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ProductCard } from '@/components/loan/product-card';
import { RepaymentDialog } from '@/components/loan/repayment-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getCustomIcon } from '@/lib/types';
import { recalculateScoreAndLoanLimit } from '@/actions/eligibility';
import { useToast } from '@/hooks/use-toast';


const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

// A helper to map string names to actual icon components
const iconMap: { [key: string]: React.ElementType } = {
  Building2,
  Landmark,
  Briefcase,
  Home,
  PersonStanding,
  CreditCard,
  Wallet,
};

const IconDisplay = ({ iconName, className }: { iconName: string; className?: string }) => {
    const isCustom = typeof iconName === 'string' && iconName.startsWith('custom-icon-');
    const [customIconSrc, setCustomIconSrc] = useState<string | null>(null);

    useEffect(() => {
        if (isCustom) {
            const src = getCustomIcon(iconName);
            setCustomIconSrc(src);
        }
    }, [iconName, isCustom]);

    if (isCustom) {
        return customIconSrc ? <img src={customIconSrc} alt="Custom Icon" className={cn("h-8 w-8", className)} /> : <div className={cn("h-8 w-8", className)} />;
    }

    const IconComponent = iconMap[iconName] || Building2;
    return <IconComponent className={cn("h-8 w-8 text-muted-foreground", className)} />;
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
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  const isEligible = !eligibilityError;

  const initialMaxLoan = useMemo(() => {
    return searchParams.has('max') ? parseFloat(searchParams.get('max')!) : 0;
  }, [searchParams]);

  const [currentMaxLoanLimit, setCurrentMaxLoanLimit] = useState(initialMaxLoan);


  useEffect(() => {
    setLoanHistory(initialLoanHistory);
  }, [initialLoanHistory]);

  useEffect(() => {
    if (providerIdFromUrl) {
      setSelectedProviderId(providerIdFromUrl);
    } else if (providers.length > 0) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providerIdFromUrl, providers]);
  
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
    const params = new URLSearchParams(searchParams);
    params.set('providerId', selectedProviderId);
    params.set('product', productId);
    // Pass the currently calculated max loan for this provider
    params.set('max', String(currentMaxLoanLimit));
    router.push(`/apply?${params.toString()}`);
  }

  const handleProviderSelect = async (providerId: string) => {
    setSelectedProviderId(providerId);
    setIsRecalculating(true);
    
    if (customerId) {
        const { maxLoanAmount } = await recalculateScoreAndLoanLimit(Number(customerId), Number(providerId));
        setCurrentMaxLoanLimit(maxLoanAmount);
    }

    setIsRecalculating(false);

    const params = new URLSearchParams(searchParams.toString());
    params.set('providerId', providerId);
    router.push(`/loan?${params.toString()}`, { scroll: false });
  }
  
  const handleRepay = (loan: LoanDetails) => {
    setRepayingLoan(loan);
    setIsRepayDialogOpen(true);
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
                                          {isRecalculating && selectedProviderId === provider.id ? <Loader2 className="h-8 w-8 animate-spin" /> : <IconDisplay iconName={provider.icon} />}
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
              
                  <div className="grid gap-8 grid-cols-1">
                      <div>
                          <Accordion type="single" collapsible className="w-full" defaultValue="loan-history">
                              <AccordionItem value="loan-history" className="border-none">
                                  <AccordionTrigger className="text-muted-foreground p-4 rounded-lg text-lg font-semibold hover:no-underline [&[data-state=open]>svg]:rotate-180" style={{ backgroundColor: selectedProvider ? `${selectedProvider.colorHex}1A` : '#fef3c7' }}>
                                      <div className="flex items-center justify-between w-full" style={{ color: selectedProvider?.colorHex }}>
                                          <span>Loan History</span>
                                      </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <Card className="mt-2 shadow-sm rounded-lg">
                                        <CardContent className="p-0">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                        <TableHead className="py-3 px-4"></TableHead>
                                                        <TableHead className="py-3 px-4">Product</TableHead>
                                                        <TableHead className="py-3 px-4">Disbursed Date</TableHead>
                                                        <TableHead className="py-3 px-4">Due Date</TableHead>
                                                        <TableHead className="text-right py-3 px-4">Amount</TableHead>
                                                        <TableHead className="text-right py-3 px-4">Repaid</TableHead>
                                                        <TableHead className="text-center py-3 px-4">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                {loanHistory.map((loan) => (
                                                    <React.Fragment key={loan.id}>
                                                        <TableRow className={cn(loan.payments && loan.payments.length > 1 && "cursor-pointer")} onClick={() => loan.payments && loan.payments.length > 1 && setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}>
                                                            <TableCell className="px-4">
                                                                {loan.payments && loan.payments.length > 1 && (
                                                                    expandedLoan === loan.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="font-medium py-3 px-4">{loan.productName}</TableCell>
                                                            <TableCell className="py-3 px-4">{format(new Date(loan.disbursedDate), 'yyyy-MM-dd')}</TableCell>
                                                            <TableCell className="py-3 px-4">{format(new Date(loan.dueDate), 'yyyy-MM-dd')}</TableCell>
                                                            <TableCell className="text-right py-3 px-4">{formatCurrency(loan.loanAmount)}</TableCell>
                                                            <TableCell className="text-right py-3 px-4">{formatCurrency(loan.repaidAmount || 0)}</TableCell>
                                                            <TableCell className="text-center py-3 px-4">
                                                                <Badge variant={loan.repaymentStatus === 'Paid' ? 'secondary' : 'destructive'}>
                                                                {loan.repaymentStatus}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                        {expandedLoan === loan.id && loan.payments && loan.payments.length > 1 && (
                                                          <TableRow>
                                                              <TableCell colSpan={7} className="p-0">
                                                                  <div className="p-4 bg-secondary/50">
                                                                      <h4 className="font-semibold mb-2 text-sm">Payment History</h4>
                                                                      <Table>
                                                                          <TableHeader>
                                                                              <TableRow className="bg-secondary hover:bg-secondary">
                                                                                  <TableHead>Payment No.</TableHead>
                                                                                  <TableHead>Date</TableHead>
                                                                                  <TableHead className="text-right">Outstanding Balance</TableHead>
                                                                                  <TableHead className="text-right">Amount Paid</TableHead>
                                                                              </TableRow>
                                                                          </TableHeader>
                                                                          <TableBody>
                                                                              {loan.payments.map((payment, pIndex) => (
                                                                                  <TableRow key={pIndex}>
                                                                                      <TableCell>#{pIndex + 1}</TableCell>
                                                                                      <TableCell>{format(new Date(payment.date), 'yyyy-MM-dd')}</TableCell>
                                                                                      <TableCell className="text-right">{formatCurrency(payment.outstandingBalanceBeforePayment ?? 0)}</TableCell>
                                                                                      <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                                                                                  </TableRow>
                                                                              ))}
                                                                          </TableBody>
                                                                      </Table>
                                                                  </div>
                                                              </TableCell>
                                                          </TableRow>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                  </AccordionContent>
                              </AccordionItem>
                          </Accordion>
                      </div>
                      <div>
                      {selectedProvider && isEligible && (
                          <Card>
                              <CardHeader>
                                  <CardTitle>Available Loan Products</CardTitle>
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
                                      />
                                  ))}
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
