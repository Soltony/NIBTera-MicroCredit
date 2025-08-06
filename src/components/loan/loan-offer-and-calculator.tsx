
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { LoanProduct, LoanDetails, CheckLoanEligibilityOutput } from '@/lib/types';
import { addDays, format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';

interface LoanOfferAndCalculatorProps {
  product: LoanProduct;
  isLoading: boolean;
  eligibilityResult: CheckLoanEligibilityOutput | null;
  onAccept: (details: Omit<LoanDetails, 'providerName' | 'productName' | 'payments' >) => void;
  providerColor?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function LoanOfferAndCalculator({ product, isLoading, eligibilityResult, onAccept, providerColor = 'hsl(var(--primary))' }: LoanOfferAndCalculatorProps) {
  const [loanAmount, setLoanAmount] = useState<number | string>('');
  const [amountError, setAmountError] = useState('');

  const { suggestedLoanAmountMin = 0, suggestedLoanAmountMax = 0 } = eligibilityResult || {};
  
  const minLoan = product.minLoan ?? 0;
  const maxLoan = product.maxLoan ?? 0;

  useEffect(() => {
    // Set initial loan amount, respecting the lower of suggested min and product min
    setLoanAmount(minLoan);
  }, [product.id, minLoan]);
  

  const calculatedTerms = useMemo(() => {
    const numericLoanAmount = typeof loanAmount === 'string' ? parseFloat(loanAmount) : loanAmount;
    if (!eligibilityResult?.isEligible || isNaN(numericLoanAmount) || numericLoanAmount <= 0) return null;
    const serviceFee = numericLoanAmount * 0.015;
    const interest = numericLoanAmount * 0.05;
    const interestRate = numericLoanAmount * 0.05; // Fixed 5%
    const penaltyAmount = numericLoanAmount * 0.1;
    const dueDate = addDays(new Date(), 30);
    const totalRepayable = numericLoanAmount + serviceFee + interest;

    return { serviceFee, interestRate, penaltyAmount, dueDate, totalRepayable };
  }, [loanAmount, eligibilityResult]);

  const validateAmount = (amount: number | string) => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount) || numericAmount > maxLoan || numericAmount < minLoan) {
      setAmountError(`Please enter an amount between ${formatCurrency(minLoan)} and ${formatCurrency(maxLoan)}.`);
      return false;
    }
    setAmountError('');
    return true;
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setLoanAmount('');
      setAmountError(`Please enter an amount between ${formatCurrency(minLoan)} and ${formatCurrency(maxLoan)}.`);
    } else {
      setLoanAmount(value);
      validateAmount(value);
    }
  };
  
  const handleAccept = () => {
    const numericLoanAmount = typeof loanAmount === 'string' ? parseFloat(loanAmount) : loanAmount;
    if (calculatedTerms && !isNaN(numericLoanAmount)) {
      if (!validateAmount(numericLoanAmount)) {
        return;
      }
      onAccept({
        loanAmount: numericLoanAmount,
        repaymentStatus: 'Unpaid',
        repaidAmount: 0,
        ...calculatedTerms,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-32" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!eligibilityResult) {
    return null; // Or some other placeholder
  }

  if (!eligibilityResult.isEligible) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Eligible for Loan</AlertTitle>
          <AlertDescription>
            {eligibilityResult.reason || "We're sorry, but you are not eligible for this loan product at this time."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }


  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold font-headline">{product.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label htmlFor="loanAmount" className="text-sm font-medium">Enter Your Desired Loan Amount</Label>
            <Input
              id="loanAmount"
              type="number"
              value={loanAmount}
              onChange={handleAmountChange}
              className={cn(
                "w-full text-xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                amountError ? "border-destructive ring-destructive ring-2" : ""
              )}
              min={minLoan}
              max={maxLoan}
              style={{'--ring': amountError ? 'hsl(var(--destructive))' : providerColor} as React.CSSProperties}
            />
            {amountError ? (
              <p className="text-sm text-destructive">{amountError}</p>
            ) : (
             <p className="text-sm text-muted-foreground text-center">
              Credit Limit: {formatCurrency(minLoan ?? 0)} - {formatCurrency(maxLoan ?? 0)}
            </p>
            )}
          </div>

          {calculatedTerms && (
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm bg-secondary p-4 rounded-lg">
                    <div className="font-medium">Service Fee</div>
                    <div className="text-right">{product.serviceFee}</div>
                    
                    <div className="font-medium">Daily Fee</div>
                    <div className="text-right">{product.dailyFee}</div>
                    
                    <div className="font-medium text-destructive">Penalty Fee After Due Date</div>
                    <div className="text-right text-destructive">{product.penaltyFee}</div>
                </div>

                <div className="flex justify-between items-center p-4 rounded-lg border">
                    <span className="text-base font-semibold">Total Repayable Amount on due date</span>
                    <span className="text-2xl font-bold" style={{color: providerColor}}>
                        {formatCurrency(calculatedTerms.totalRepayable)}
                    </span>
                </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button size="lg" className="w-full text-white" onClick={handleAccept} disabled={!!amountError} style={{backgroundColor: providerColor}}>
            Accept and Disburse Loan
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
