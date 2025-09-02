
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LoanDetails, LoanProvider } from '@/lib/types';
import { format } from 'date-fns';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { RepaymentDialog } from '@/components/loan/repayment-dialog';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return '0.00';
  return new Intl.NumberFormat('en-US', { style: 'decimal' }).format(amount);
};


interface HistoryClientProps {
  initialLoanHistory: LoanDetails[];
  providers: LoanProvider[];
}

export function HistoryClient({ initialLoanHistory, providers }: HistoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [loanHistory, setLoanHistory] = useState(initialLoanHistory);
  const [activeTab, setActiveTab] = useState('active');
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
  const [repayingLoanInfo, setRepayingLoanInfo] = useState<{ loan: LoanDetails, balanceDue: number } | null>(null);

  useEffect(() => {
    setLoanHistory(initialLoanHistory);
  }, [initialLoanHistory]);

  const handleBack = () => {
    router.push(`/loan?${searchParams.toString()}`)
  }

  const { activeLoans, closedLoans } = useMemo(() => {
    const active = loanHistory.filter(loan => loan.repaymentStatus === 'Unpaid');
    const closed = loanHistory.filter(loan => loan.repaymentStatus === 'Paid');
    return { activeLoans: active, closedLoans: closed };
  }, [loanHistory]);

  const totalOutstanding = useMemo(() => {
    return activeLoans.reduce((acc, loan) => {
      const balance = calculateTotalRepayable(loan, loan.product, new Date());
      return acc + Math.max(0, balance.total - (loan.repaidAmount || 0));
    }, 0);
  }, [activeLoans]);
  
  const totalCreditAmount = useMemo(() => {
    return loanHistory.reduce((acc, loan) => acc + loan.loanAmount, 0);
  }, [loanHistory]);
  
  const totalRepaidAmount = useMemo(() => {
    return loanHistory.reduce((acc, loan) => acc + (loan.repaidAmount || 0), 0);
  }, [loanHistory]);
  
  const themeColor = useMemo(() => {
    const loans = activeTab === 'active' ? activeLoans : closedLoans;
    if (loans.length > 0) {
      const firstProvider = providers.find(p => p.id === loans[0].product.providerId);
      return firstProvider?.colorHex || '#fdb913';
    }
    return '#fdb913'; // Default color if no loans
  }, [activeTab, activeLoans, closedLoans, providers]);


  const handleRepay = (loan: LoanDetails) => {
    const balanceDue = calculateTotalRepayable(loan, loan.product, new Date()).total - (loan.repaidAmount || 0);
    setRepayingLoanInfo({ loan, balanceDue: Math.max(0, balanceDue) });
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
        description: `${formatCurrency(amount)} ETB has been paid towards your loan.`,
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


  const renderLoanCard = (loan: LoanDetails) => {
    const balanceDue = calculateTotalRepayable(loan, loan.product, new Date()).total - (loan.repaidAmount || 0);
    const provider = providers.find(p => p.id === loan.product.providerId);
    const color = provider?.colorHex || '#fdb913';

    return (
      <Card key={loan.id} className="shadow-md">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-gray-800">{loan.productName}</p>
              <p className="text-lg font-bold" style={{color: color}}>{formatCurrency(balanceDue > 0 ? balanceDue : loan.loanAmount)} <span className="text-sm font-normal text-muted-foreground">(ETB)</span></p>
              <p className="text-xs text-muted-foreground">{loan.id}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}>View</Button>
              {loan.repaymentStatus === 'Unpaid' && <Button size="sm" style={{backgroundColor: color}} className="text-white" onClick={() => handleRepay(loan)}>Repay</Button>}
            </div>
          </div>
          {expandedLoan === loan.id && (
             <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Original Amount:</span> <span className="font-medium">{formatCurrency(loan.loanAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Disbursed Date:</span> <span className="font-medium">{format(new Date(loan.disbursedDate), 'PPP')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Due Date:</span> <span className="font-medium">{format(new Date(loan.dueDate), 'PPP')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Repaid:</span> <span className="font-medium">{formatCurrency(loan.repaidAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Current Balance:</span> <span className="font-medium">{formatCurrency(balanceDue)}</span></div>
             </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
        <header className="sticky top-0 z-40 w-full border-b bg-white">
          <div className="container flex h-16 items-center">
            <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2 text-gray-700 hover:bg-gray-100">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
               <h1 className="text-lg font-semibold tracking-tight text-gray-800">
                  Loan History
              </h1>
            </div>
          </div>
        </header>
        <main className="flex-1">
            <div className="container py-6 md:py-10">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-gray-200">
                        <TabsTrigger value="active">Active</TabsTrigger>
                        <TabsTrigger value="closed">Closed</TabsTrigger>
                    </TabsList>
                    
                    <div className="my-6">
                      {activeTab === 'active' ? (
                          <Card className="shadow-lg text-white" style={{ backgroundColor: themeColor }}>
                            <CardContent className="p-4 flex justify-around items-center">
                              <div className="text-center">
                                <p className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</p>
                                <p className="text-xs opacity-90">Total Outstanding Amount (ETB)</p>
                              </div>
                               <div className="text-center">
                                <p className="text-2xl font-bold">{formatCurrency(totalCreditAmount)}</p>
                                <p className="text-xs opacity-90">Total Credit Amount (ETB)</p>
                              </div>
                            </CardContent>
                          </Card>
                      ) : (
                          <Card className="shadow-lg text-white" style={{ backgroundColor: themeColor }}>
                            <CardContent className="p-4 flex justify-around items-center">
                              <div className="text-center">
                                <p className="text-2xl font-bold">{formatCurrency(totalRepaidAmount)}</p>
                                <p className="text-xs opacity-90">Total Amount Repaid (ETB)</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold">{closedLoans.length}</p>
                                <p className="text-xs opacity-90">Total Loans Closed</p>
                              </div>
                            </CardContent>
                          </Card>
                      )}
                    </div>
                    
                    <TabsContent value="active">
                       <div className="space-y-4">
                           {activeLoans.length > 0 ? activeLoans.map(renderLoanCard) : <p className="text-center text-muted-foreground py-8">No active loans.</p>}
                       </div>
                    </TabsContent>
                    <TabsContent value="closed">
                       <div className="space-y-4">
                           {closedLoans.length > 0 ? closedLoans.map(renderLoanCard) : <p className="text-center text-muted-foreground py-8">No closed loans.</p>}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </main>
        {repayingLoanInfo && (
            <RepaymentDialog
                isOpen={isRepayDialogOpen}
                onClose={() => setIsRepayDialogOpen(false)}
                onConfirm={handleConfirmRepayment}
                loan={repayingLoanInfo.loan}
                totalBalanceDue={repayingLoanInfo.balanceDue}
                providerColor={providers.find(p => p.id === repayingLoanInfo.loan.product.providerId)?.colorHex}
            />
        )}
    </div>
  );
}
