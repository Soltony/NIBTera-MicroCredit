'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LoanDetails, LoanProvider } from '@/lib/types';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

interface HistoryClientProps {
  initialLoanHistory: LoanDetails[];
  providers: LoanProvider[];
}

export function HistoryClient({ initialLoanHistory, providers }: HistoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  const handleBack = () => {
    router.push(`/loan?${searchParams.toString()}`)
  }

  const filteredHistory = useMemo(() => {
    return initialLoanHistory.filter(loan => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' || 
        loan.productName.toLowerCase().includes(searchTermLower) ||
        loan.providerName.toLowerCase().includes(searchTermLower) ||
        loan.id.toString().includes(searchTermLower);
      
      const matchesStatus = statusFilter === 'all' || loan.repaymentStatus.toLowerCase() === statusFilter;
      const matchesProvider = providerFilter === 'all' || loan.providerName === providerFilter;

      return matchesSearch && matchesStatus && matchesProvider;
    });
  }, [initialLoanHistory, searchTerm, statusFilter, providerFilter]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-40 w-full border-b bg-background">
          <div className="container flex h-16 items-center">
            <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2 text-primary hover:bg-primary/10">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
               <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  Loan History
              </h1>
            </div>
          </div>
        </header>
        <main className="flex-1">
            <div className="container py-8 md:py-12">
              <Card>
                <CardHeader>
                  <CardTitle>Loan History</CardTitle>
                  <CardDescription>A complete record of all your past and present loans.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <Input 
                      placeholder="Search by product, provider, or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-grow"
                    />
                    <div className="flex gap-4">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full md:w-[180px]">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={providerFilter} onValueChange={setProviderFilter}>
                        <SelectTrigger className="w-full md:w-[180px]">
                          <SelectValue placeholder="Filter by provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Providers</SelectItem>
                          {providers.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Repaid</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHistory.length > 0 ? filteredHistory.map((loan) => (
                          <React.Fragment key={loan.id}>
                            <TableRow className="cursor-pointer" onClick={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}>
                              <TableCell className="text-center">
                                {loan.payments && loan.payments.length > 0 ? (
                                  expandedLoan === loan.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                ) : null}
                              </TableCell>
                              <TableCell className="font-medium">{loan.providerName}</TableCell>
                              <TableCell>{loan.productName}</TableCell>
                              <TableCell>{format(new Date(loan.dueDate), 'yyyy-MM-dd')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(loan.loanAmount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(loan.repaidAmount || 0)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={loan.repaymentStatus === 'Paid' ? 'secondary' : 'destructive'} style={{backgroundColor: loan.repaymentStatus !== 'Paid' ? '' : providers.find(p => p.name === loan.providerName)?.colorHex, color: 'white'}}>
                                  {loan.repaymentStatus}
                                </Badge>
                              </TableCell>
                            </TableRow>
                            {expandedLoan === loan.id && (
                              <TableRow>
                                <TableCell colSpan={7} className="p-0">
                                  <div className="p-4 bg-secondary/50 space-y-4">
                                    <h4 className="font-semibold text-md">Loan Details</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div><span className="text-muted-foreground">Loan ID:</span> {loan.id}</div>
                                        <div><span className="text-muted-foreground">Disbursed:</span> {format(new Date(loan.disbursedDate), 'yyyy-MM-dd')}</div>
                                        <div><span className="text-muted-foreground">Service Fee:</span> {formatCurrency(loan.serviceFee)}</div>
                                        <div><span className="text-muted-foreground">Penalty:</span> {formatCurrency(loan.penaltyAmount)}</div>
                                    </div>
                                    {loan.payments && loan.payments.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-md mt-4 mb-2">Payment History</h4>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-secondary hover:bg-secondary text-xs">
                                                        <TableHead>Payment No.</TableHead>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead className="text-right">Outstanding Balance</TableHead>
                                                        <TableHead className="text-right">Amount Paid</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {loan.payments.map((payment, pIndex) => (
                                                        <TableRow key={pIndex} className="text-sm">
                                                            <TableCell>#{pIndex + 1}</TableCell>
                                                            <TableCell>{format(new Date(payment.date), 'yyyy-MM-dd')}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(payment.outstandingBalanceBeforePayment ?? 0)}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                              No loans match your criteria.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
        </main>
    </div>
  );
}