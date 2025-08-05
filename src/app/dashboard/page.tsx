
'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { LoanDetails, LoanProvider, LoanProduct } from '@/lib/types';
import { Logo } from '@/components/icons';
import { format } from 'date-fns';
import { Building2, Landmark, Briefcase, Home, PersonStanding } from 'lucide-react';
import { LoanSummaryCard } from '@/components/loan/loan-summary-card';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const mockProviders: LoanProvider[] = [
  {
    id: 'provider-1',
    name: 'Capital Bank',
    icon: Building2,
    products: [
      { id: 'prod-1a', name: 'Personal Loan', description: 'Flexible personal loans for your needs.', icon: PersonStanding, minLoan: 400, maxLoan: 2000 },
      { id: 'prod-1b', name: 'Home Improvement Loan', description: 'Finance your home renovation projects.', icon: Home, minLoan: 10000, maxLoan: 50000 },
    ],
  },
  {
    id: 'provider-2',
    name: 'Providus Financial',
    icon: Landmark,
    products: [
      { id: 'prod-2a', name: 'Startup Business Loan', description: 'Kickstart your new business venture.', icon: Briefcase },
      { id: 'prod-2b', name: 'Personal Auto Loan', description: 'Get behind the wheel of your new car.', icon: PersonStanding },
    ],
  },
  {
    id: 'provider-3',
    name: 'FairMoney Group',
    icon: Building2,
    products: [
      { id: 'prod-3a', name: 'Quick Cash Loan', description: 'Instant cash for emergencies.', icon: PersonStanding },
      { id: 'prod-3b', name: 'Gadget Financing', description: 'Upgrade your devices with easy financing.', icon: Home },
    ],
  },
];


const mockLoanHistory: LoanDetails[] = [
    {
        providerName: 'Capital Bank',
        productName: 'Personal Loan',
        loanAmount: 5000,
        serviceFee: 75,
        interestRate: 5.0,
        dueDate: new Date('2024-08-15'),
        penaltyAmount: 500,
        repaymentStatus: 'Paid',
    },
    {
        providerName: 'Providus Financial',
        productName: 'Startup Business Loan',
        loanAmount: 25000,
        serviceFee: 375,
        interestRate: 6.2,
        dueDate: new Date('2025-01-20'),
        penaltyAmount: 2500,
        repaymentStatus: 'Unpaid',
    }
];

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerId = searchParams.get('providerId');
  const selectedProvider = mockProviders.find(p => p.id === providerId) || null;

  const maxLoanLimit = useMemo(() => {
    const max = searchParams.get('max');
    return max ? parseFloat(max) : 50000;
  }, [searchParams]);

  const { totalBorrowed, availableToBorrow } = useMemo(() => {
    const totalBorrowed = mockLoanHistory
      .filter(loan => loan.repaymentStatus === 'Unpaid')
      .reduce((acc, loan) => acc + loan.loanAmount, 0);
    const availableToBorrow = maxLoanLimit - totalBorrowed;
    return { totalBorrowed, availableToBorrow };
  }, [maxLoanLimit]);

  const handleApply = (productId: string) => {
    if(providerId) {
        router.push(`/apply?providerId=${providerId}&product=${productId}`);
    } else {
        router.push('/');
    }
  }

  const handleProductSelect = (product: LoanProduct) => {
    handleApply(product.id);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex">
            <a className="mr-6 flex items-center space-x-2" href="/">
              <Logo className="h-6 w-6" />
              <span className="font-bold">LoanFlow Mini</span>
            </a>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
             <Button variant="ghost" onClick={() => router.push('/')}>Change Provider</Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="container py-8 md:py-12">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-primary">
                    {selectedProvider ? `${selectedProvider.name} Dashboard` : 'Loan Dashboard'}
                </h1>
            </div>

            <div className="mb-8">
                <LoanSummaryCard
                    maxLoanLimit={maxLoanLimit}
                    availableToBorrow={availableToBorrow}
                />
            </div>
            
            <div className="grid gap-8 grid-cols-1">
                <div>
                     <Card>
                        <CardHeader>
                            <CardTitle>Loan History</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Loan</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mockLoanHistory.map((loan, index) => (
                                        <TableRow key={index}>
                                            <TableCell>
                                                <div className="font-medium">{loan.productName}</div>
                                                <div className="text-sm text-muted-foreground">{loan.providerName}</div>
                                            </TableCell>
                                            <TableCell>{formatCurrency(loan.loanAmount)}</TableCell>
                                            <TableCell>{format(loan.dueDate, 'PPP')}</TableCell>
                                            <TableCell className="text-right">
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
                </div>
                <div>
                {selectedProvider && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Available Loan Products</CardTitle>
                            <CardDescription>Select a product to start a new application.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {selectedProvider.products.map((product) => (
                                <Card
                                    key={product.id}
                                    onClick={() => handleProductSelect(product)}
                                    className="cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-300"
                                >
                                    <CardHeader>
                                        <div className="flex items-center gap-4">
                                            <div className="bg-secondary p-3 rounded-full">
                                                <product.icon className="h-6 w-6 text-primary" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">{product.name}</CardTitle>
                                                <CardDescription>
                                                    {product.description}
                                                    {product.minLoan && product.maxLoan && (
                                                        <span className="block text-sm text-muted-foreground mt-1">
                                                            {formatCurrency(product.minLoan)} - {formatCurrency(product.maxLoan)}
                                                        </span>
                                                    )}
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            ))}
                        </CardContent>
                    </Card>
                )}
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
