'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { LoanDetails } from '@/lib/types';
import { Logo } from '@/components/icons';
import { format } from 'date-fns';
import { DollarSign, PiggyBank } from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

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


  const handleApply = () => {
    if(providerId) {
        router.push(`/apply?providerId=${providerId}`);
    } else {
        // Fallback if no provider is selected, maybe redirect to home
        router.push('/');
    }
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
        </div>
      </header>
      <main className="flex-1">
        <div className="container py-8 md:py-12">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Loan Dashboard</h1>
                <Button size="lg" onClick={handleApply}>Apply for New Loan</Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Loan History</CardTitle>
                    <CardDescription>View your past and current loans.</CardDescription>
                </CardHeader>
                <CardContent>
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
      </main>
    </div>
  );
}
