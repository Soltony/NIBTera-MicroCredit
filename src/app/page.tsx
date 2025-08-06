

'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LoanDetails, LoanProvider, LoanProduct } from '@/lib/types';
import { Logo } from '@/components/icons';
import { format } from 'date-fns';
import { Building2, Landmark, Briefcase, Home, PersonStanding, CreditCard, Wallet, ChevronDown, ArrowLeft, ChevronRight } from 'lucide-react';
import { LoanSummaryCard } from '@/components/loan/loan-summary-card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ProductCard } from '@/components/loan/product-card';

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
      { id: 'prod-3a', name: 'Quick Cash Loan', description: 'Instant cash for emergencies.', icon: PersonStanding, minLoan: 500, maxLoan: 2500, facilitationFee: '1.5%', dailyFee: '5.0%', penaltyFee: '10%', availableLimit: 0 },
      { id: 'prod-3b', name: 'Gadget Financing', description: 'Upgrade your devices with easy financing.', icon: Home, minLoan: 300, maxLoan: 1500, facilitationFee: '1.5%', dailyFee: '5.0%', penaltyFee: '10%', availableLimit: 0 },
    ],
  },
  {
    id: 'provider-1',
    name: 'Capital Bank',
    icon: Building2,
    color: 'text-blue-600',
    colorHex: '#2563eb',
    products: [
      { id: 'prod-1a', name: 'Personal Loan', description: 'Flexible personal loans for your needs.', icon: PersonStanding, minLoan: 400, maxLoan: 2000, facilitationFee: '1.5%', dailyFee: '5.0%', penaltyFee: '10%', availableLimit: 0 },
      { id: 'prod-1b', name: 'Home Improvement Loan', description: 'Finance your home renovation projects.', icon: Home, minLoan: 10000, maxLoan: 50000, facilitationFee: '1.5%', dailyFee: '5.0%', penaltyFee: '10%', availableLimit: 0 },
    ],
  },
  {
    id: 'provider-2',
    name: 'Providus Financial',
    icon: Landmark,
    color: 'text-green-600',
    colorHex: '#16a34a',
    products: [
      { id: 'prod-2a', name: 'Startup Business Loan', description: 'Kickstart your new business venture.', icon: Briefcase, minLoan: 5000, maxLoan: 100000, facilitationFee: '1.5%', dailyFee: '5.0%', penaltyFee: '10%', availableLimit: 0 },
      { id: 'prod-2b', name: 'Personal Auto Loan', description: 'Get behind the wheel of your new car.', icon: PersonStanding, minLoan: 2000, maxLoan: 30000, facilitationFee: '1.5%', dailyFee: '5.0%', penaltyFee: '10%', availableLimit: 0 },
    ],
  },
];


const mockLoanHistory: LoanDetails[] = [
    {
        providerName: 'Capital Bank',
        productName: 'Personal Loan',
        loanAmount: 100,
        serviceFee: 1.5,
        interestRate: 5.0,
        dueDate: new Date('2024-08-15'),
        penaltyAmount: 10,
        repaymentStatus: 'Unpaid',
    },
    {
        providerName: 'NIb Bank',
        productName: 'Quick Cash Loan',
        loanAmount: 500,
        serviceFee: 7.5,
        interestRate: 5.0,
        dueDate: new Date('2024-07-25'),
        penaltyAmount: 50,
        repaymentStatus: 'Paid',
    },
];

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerId = searchParams.get('providerId');

  const [selectedProviderId, setSelectedProviderId] = useState(providerId ?? mockProvidersData[0].id);
  
  const { totalBorrowed, availableToBorrow, maxLoanLimit, mockProviders } = useMemo(() => {
    const max = searchParams.get('max');
    const maxLoanLimit = max ? parseFloat(max) : 50000;

    const totalBorrowed = mockLoanHistory
      .filter(loan => loan.repaymentStatus === 'Unpaid')
      .reduce((acc, loan) => acc + loan.loanAmount, 0);

    const availableToBorrow = maxLoanLimit - totalBorrowed;

    const updatedProviders = mockProvidersData.map(provider => ({
      ...provider,
      products: provider.products.map(product => {
          const productMax = product.maxLoan ?? 0;
          const available = Math.max(0, productMax - totalBorrowed);
          return {
              ...product,
              availableLimit: available
          }
      })
    }));

    return { totalBorrowed, availableToBorrow, maxLoanLimit, mockProviders: updatedProviders };
  }, [searchParams]);

  const selectedProvider = useMemo(() => {
    return mockProviders.find(p => p.id === selectedProviderId) || null;
  }, [selectedProviderId, mockProviders]);

  const handleApply = (productId: string) => {
    if(selectedProviderId) {
        router.push(`/apply?providerId=${selectedProviderId}&product=${productId}`);
    } else {
        router.push('/');
    }
  }

  const handleProviderSelect = (provider: LoanProvider) => {
    setSelectedProviderId(provider.id);
    const params = new URLSearchParams(searchParams);
    params.set('providerId', provider.id);
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  const handleProductSelect = (product: LoanProduct) => {
    handleApply(product.id);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b" style={{ backgroundColor: selectedProvider?.colorHex || '#fdb913' }}>
        <div className="container flex h-16 items-center">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2 text-primary-foreground hover:bg-white/20">
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
                                                        <TableHead className="py-3 px-4">Product</TableHead>
                                                        <TableHead className="py-3 px-4">Provider</TableHead>
                                                        <TableHead className="text-right py-3 px-4">Amount</TableHead>
                                                        <TableHead className="text-center py-3 px-4">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                {mockLoanHistory.map((loan, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-medium py-3 px-4">{loan.productName}</TableCell>
                                                        <TableCell className="py-3 px-4">{loan.providerName}</TableCell>
                                                        <TableCell className="text-right py-3 px-4">{formatCurrency(loan.loanAmount)}</TableCell>
                                                        <TableCell className="text-center py-3 px-4">
                                                            <Badge variant={loan.repaymentStatus === 'Paid' ? 'secondary' : 'destructive'}>
                                                            {loan.repaymentStatus}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
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
                    {selectedProvider && (
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
                                        onApply={() => handleProductSelect(product)}
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
  );
}
