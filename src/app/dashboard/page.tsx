
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

const mockProvidersData: LoanProvider[] = [
    {
    id: 'provider-3',
    name: 'NIb Bank',
    icon: Building2,
    color: 'text-yellow-500',
    colorHex: '#fdb913',
    products: [
      { id: 'prod-3a', name: 'Quick Cash Loan', description: 'Instant cash for emergencies.', icon: PersonStanding, minLoan: 500, maxLoan: 2500, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
      { id: 'prod-3b', name: 'Gadget Financing', description: 'Upgrade your devices with easy financing.', icon: Home, minLoan: 300, maxLoan: 1500, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
    ],
  },
  {
    id: 'provider-1',
    name: 'Capital Bank',
    icon: Building2,
    color: 'text-blue-600',
    colorHex: '#2563eb',
    products: [
      { id: 'prod-1a', name: 'Personal Loan', description: 'Flexible personal loans for your needs.', icon: PersonStanding, minLoan: 400, maxLoan: 2000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
      { id: 'prod-1b', name: 'Home Improvement Loan', description: 'Finance your home renovation projects.', icon: Home, minLoan: 10000, maxLoan: 50000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
    ],
  },
  {
    id: 'provider-2',
    name: 'Providus Financial',
    icon: Landmark,
    color: 'text-green-600',
    colorHex: '#16a34a',
    products: [
      { id: 'prod-2a', name: 'Startup Business Loan', description: 'Kickstart your new business venture.', icon: Briefcase, minLoan: 5000, maxLoan: 100000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
      { id: 'prod-2b', name: 'Personal Auto Loan', description: 'Get behind the wheel of your new car.', icon: PersonStanding, minLoan: 2000, maxLoan: 30000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
    ],
  },
];

const calculateTotalRepayable = (loan: LoanDetails) => {
    const principal = loan.loanAmount;
    const serviceFee = loan.serviceFee;
    const now = new Date();
    const dueDate = new Date(loan.dueDate);

    // Daily fee is 0.2% of loan amount
    const dailyFeeRate = 0.002;
    const loanStartDate = new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const daysSinceLoan = differenceInDays(now, loanStartDate);
    const dailyFees = principal * dailyFeeRate * Math.max(0, daysSinceLoan);

    const penalty = now > dueDate ? loan.penaltyAmount : 0;
    
    return principal + serviceFee + dailyFees + penalty;
};

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerId = searchParams.get('providerId');
  const eligibilityError = searchParams.get('error');

  const [selectedProviderId, setSelectedProviderId] = useState(providerId ?? 'provider-3');
  const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
  const [repayingLoan, setRepayingLoan] = useState<LoanDetails | null>(null);
  const { loans: loanHistory, addPayment } = useLoanHistory();
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  useEffect(() => {
    if (providerId) {
      setSelectedProviderId(providerId);
    }
  }, [providerId]);

  const { totalBorrowed, availableToBorrow, maxLoanLimit, mockProviders, activeLoansByProduct } = useMemo(() => {
    const max = searchParams.get('max');
    const maxLoanLimit = max ? parseFloat(max) : 0; // Default to 0 if not eligible

    const unpaidLoans = loanHistory.filter(loan => loan.repaymentStatus === 'Unpaid');
    
    const totalBorrowed = unpaidLoans.reduce((acc, loan) => acc + loan.loanAmount, 0);
    const availableToBorrow = Math.max(0, maxLoanLimit - totalBorrowed);

    const activeLoansByProduct = unpaidLoans.reduce((acc, loan) => {
        // Only consider the most recent loan for a given product
        if (!acc[loan.productName] || new Date(loan.dueDate) > new Date(acc[loan.productName].dueDate)) {
            acc[loan.productName] = loan;
        }
        return acc;
    }, {} as Record<string, LoanDetails>);

    const updatedProviders = mockProvidersData.map(provider => ({
      ...provider,
      products: provider.products.map(product => {
          const productMax = product.maxLoan ?? 0;
          // Ensure available limit respects both product max and overall max limit
          const available = Math.min(productMax, availableToBorrow);
          return {
              ...product,
              availableLimit: available
          }
      })
    }));

    return { totalBorrowed, availableToBorrow, maxLoanLimit, mockProviders: updatedProviders, activeLoansByProduct };
  }, [searchParams, loanHistory]);

  const selectedProvider = useMemo(() => {
    return mockProviders.find(p => p.id === selectedProviderId) || mockProviders.find(p => p.id === 'provider-3') || null;
  }, [selectedProviderId, mockProviders]);

  const handleApply = (productId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('providerId', selectedProviderId);
    params.set('product', productId);
    router.push(`/apply?${params.toString()}`);
  }

  const handleProviderSelect = (provider: LoanProvider) => {
    // Rerun eligibility check for the selected provider
    router.push(`/check-eligibility?providerId=${provider.id}`);
  }

  const handleProductSelect = (product: LoanProduct) => {
    handleApply(product.id);
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
            <div className="flex flex-1 items-center justify-end space-x-4">
            </div>
          </div>
        </header>
        <main className="flex-1">
          <div className="container py-8 md:py-12">
              <div className="flex flex-col space-y-8">
                  <div>
                      <div className="flex justify-center space-x-4 overflow-x-auto pb-4">
                          {mockProviders.map((provider) => (
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
                                                        <TableHead className="py-3 px-4">Provider</TableHead>
                                                        <TableHead className="text-right py-3 px-4">Amount</TableHead>
                                                        <TableHead className="text-right py-3 px-4">Repaid</TableHead>
                                                        <TableHead className="text-center py-3 px-4">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                {loanHistory.map((loan) => (
                                                    <React.Fragment key={loan.id}>
                                                        <TableRow className="cursor-pointer" onClick={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}>
                                                            <TableCell className="px-4">
                                                                {loan.payments && loan.payments.length > 0 && (
                                                                    expandedLoan === loan.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="font-medium py-3 px-4">{loan.productName}</TableCell>
                                                            <TableCell className="py-3 px-4">{loan.providerName}</TableCell>
                                                            <TableCell className="text-right py-3 px-4">{formatCurrency(loan.loanAmount)}</TableCell>
                                                            <TableCell className="text-right py-3 px-4">{formatCurrency(loan.repaidAmount || 0)}</TableCell>
                                                            <TableCell className="text-center py-3 px-4">
                                                                <Badge variant={loan.repaymentStatus === 'Paid' ? 'secondary' : 'destructive'}>
                                                                {loan.repaymentStatus}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                        {expandedLoan === loan.id && loan.payments && loan.payments.length > 0 && (
                                                          <TableRow>
                                                              <TableCell colSpan={6} className="p-0">
                                                                  <div className="p-4 bg-secondary/50">
                                                                      <h4 className="font-semibold mb-2 text-sm">Payment History</h4>
                                                                      <Table>
                                                                          <TableHeader>
                                                                              <TableRow className="bg-secondary hover:bg-secondary">
                                                                                  <TableHead>Payment No.</TableHead>
                                                                                  <TableHead>Date</TableHead>
                                                                                  <TableHead className="text-right">Amount</TableHead>
                                                                              </TableRow>
                                                                          </TableHeader>
                                                                          <TableBody>
                                                                              {loan.payments.map((payment, pIndex) => (
                                                                                  <TableRow key={pIndex}>
                                                                                      <TableCell>#{pIndex + 1}</TableCell>
                                                                                      <TableCell>{format(payment.date, 'yyyy-MM-dd')}</TableCell>
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
                                  {selectedProvider.products.map((product) => (
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

    