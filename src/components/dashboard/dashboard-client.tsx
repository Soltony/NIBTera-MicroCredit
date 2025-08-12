
'use client';

import React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LoanDetails, LoanProvider, LoanProduct } from '@/lib/types';
import { Logo } from '@/components/icons';
import { format, differenceInDays } from 'date-fns';
import { Building2, Landmark, Briefcase, Home, PersonStanding, CreditCard, Wallet, ChevronDown, ArrowLeft, ChevronRight, AlertCircle, ChevronUp } from 'lucide-react';
import { LoanSummaryCard } from '@/components/loan/loan-summary-card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ProductCard } from '@/components/loan/product-card';
import { RepaymentDialog } from '@/components/loan/repayment-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLoanHistory } from '@/hooks/use-loan-history';

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

interface DashboardClientProps {
  providers: LoanProvider[];
}

export function DashboardClient({ providers }: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerId = searchParams.get('providerId');
  const eligibilityError = searchParams.get('error');

  const [selectedProviderId, setSelectedProviderId] = useState(providerId ?? providers[0]?.id);
  const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
  const [repayingLoan, setRepayingLoan] = useState<LoanDetails | null>(null);
  const { loans: loanHistory, addPayment } = useLoanHistory();
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  useEffect(() => {
    if (providerId) {
      setSelectedProviderId(providerId);
    }
  }, [providerId]);
  
  const providersWithIcons = useMemo(() => {
    return providers.map(provider => ({
      ...provider,
      icon: iconMap[provider.icon] || Building2
    }));
  }, [providers]);

  const { totalBorrowed, availableToBorrow, maxLoanLimit, activeLoansByProduct, providersWithLimits } = useMemo(() => {
    const max = searchParams.get('max');
    const maxLoanLimit = max ? parseFloat(max) : 0; // Default to 0 if not eligible

    const unpaidLoans = loanHistory.filter(loan => loan.repaymentStatus === 'Unpaid');
    
    const totalBorrowed = unpaidLoans.reduce((acc, loan) => acc + loan.loanAmount, 0);
    const availableToBorrow = Math.max(0, maxLoanLimit - totalBorrowed);

    const activeLoansByProduct = unpaidLoans.reduce((acc, loan) => {
        if (!acc[loan.productName] || new Date(loan.dueDate) > new Date(acc[loan.productName].dueDate)) {
            acc[loan.productName] = loan;
        }
        return acc;
    }, {} as Record<string, LoanDetails>);

    const providersWithLimits = providersWithIcons.map(provider => ({
      ...provider,
      products: provider.products.map(product => {
          const productMax = product.maxLoan ?? 0;
          const available = Math.min(productMax, availableToBorrow);
          return {
              ...product,
              availableLimit: available,
              icon: iconMap[product.icon] || PersonStanding,
          }
      })
    }));

    return { totalBorrowed, availableToBorrow, maxLoanLimit, activeLoansByProduct, providersWithLimits };
  }, [searchParams, loanHistory, providersWithIcons]);

  const selectedProvider = useMemo(() => {
    return providersWithLimits.find(p => p.id === selectedProviderId) || providersWithLimits[0] || null;
  }, [selectedProviderId, providersWithLimits]);

  const handleApply = (productId: string, productName: string) => {
    if (activeLoansByProduct[productName]) {
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set('providerId', selectedProviderId);
    params.set('product', productId);
    router.push(`/apply?${params.toString()}`);
  }

  const handleProviderSelect = (provider: LoanProvider) => {
    router.push(`/check-eligibility?providerId=${provider.id}`);
  }

  const handleProductSelect = (product: LoanProduct) => {
    handleApply(product.id, product.name);
  }
  
  const handleRepay = (loan: LoanDetails) => {
    setRepayingLoan(loan);
    setIsRepayDialogOpen(true);
  }

  const handleConfirmRepayment = (amount: number) => {
    if (repayingLoan) {
      addPayment(repayingLoan, amount);
    }
    setIsRepayDialogOpen(false);
    setRepayingLoan(null);
  }

  const handleBack = () => {
    router.push('/');
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
                          {providersWithIcons.map((provider) => (
                              <div key={provider.id} onClick={() => handleProviderSelect(provider)} className="flex flex-col items-center space-y-2 cursor-pointer flex-shrink-0">
                                  <div 
                                      className={cn(
                                          "h-20 w-20 rounded-full flex items-center justify-center border-2 transition-all",
                                          selectedProviderId === provider.id ? `border-current` : 'border-transparent'
                                      )}
                                      style={{ color: selectedProviderId === provider.id ? provider.colorHex : 'transparent' }}
                                  >
                                      <div className={cn("h-16 w-16 rounded-full bg-card flex items-center justify-center transition-all shadow-md hover:shadow-lg", selectedProviderId === provider.id ? 'shadow-lg' : '')}>
                                          <provider.icon className="h-8 w-8 text-muted-foreground" />
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

                  {eligibilityError && (
                     <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Eligibility Check Failed</AlertTitle>
                      <AlertDescription>{eligibilityError}</AlertDescription>
                    </Alert>
                  )}

                  <LoanSummaryCard
                      maxLoanLimit={maxLoanLimit}
                      availableToBorrow={availableToBorrow}
                      color={selectedProvider?.colorHex}
                  />
              
                  <div className="grid gap-8 grid-cols-1">
                      <div>
                          <Accordion type="single" collapsible className="w-full" defaultValue="loan-history">
                              <AccordionItem value="loan-history" className="border-none">
                                  <AccordionTrigger className="text-muted-foreground p-4 rounded-lg text-lg font-semibold hover:no-underline [&[data-state=open]>svg]:rotate-180" style={{ backgroundColor: selectedProvider ? `${selectedProvider.colorHex}1A` : '#fef3c7' }}>
                                      <div className="flex items-center justify-between w-full" style={{ color: selectedProvider?.colorHex }}>
                                          <span>Loan History</span>
                                          <ChevronDown className="h-6 w-6 transition-transform duration-200" />
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
                                                            <TableCell className="py-3 px-4">{format(loan.disbursedDate, 'yyyy-MM-dd')}</TableCell>
                                                            <TableCell className="py-3 px-4">{format(loan.dueDate, 'yyyy-MM-dd')}</TableCell>
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
                                                                                      <TableCell>{format(payment.date, 'yyyy-MM-dd')}</TableCell>
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
                      {selectedProvider && !eligibilityError && (
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
                                          product={product}
                                          providerColor={selectedProvider.colorHex}
                                          activeLoan={activeLoansByProduct[product.name]}
                                          onApply={() => handleProductSelect(product)}
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

