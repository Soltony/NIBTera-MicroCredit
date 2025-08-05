'use client';

import { useState, useMemo } from 'react';
import type { LoanProduct, LoanDetails } from '@/lib/types';
import type { CheckLoanEligibilityOutput } from '@/ai/flows/loan-eligibility-check';
import { addDays, format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

interface LoanOfferAndCalculatorProps {
  product: LoanProduct;
  isLoading: boolean;
  eligibilityResult: CheckLoanEligibilityOutput | null;
  onAccept: (details: Omit<LoanDetails, 'providerName' | 'productName'>) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function LoanOfferAndCalculator({ product, isLoading, eligibilityResult, onAccept }: LoanOfferAndCalculatorProps) {
  const [loanAmount, setLoanAmount] = useState(eligibilityResult?.suggestedLoanAmountMin ?? 0);

  const calculatedTerms = useMemo(() => {
    if (!eligibilityResult?.isEligible) return null;
    const serviceFee = loanAmount * 0.015;
    const interestRate = 5.0; // Fixed 5%
    const penaltyAmount = loanAmount * 0.1;
    const dueDate = addDays(new Date(), 30);
    return { serviceFee, interestRate, penaltyAmount, dueDate };
  }, [loanAmount, eligibilityResult]);

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

  const { suggestedLoanAmountMin = 0, suggestedLoanAmountMax = 0 } = eligibilityResult;

  const handleAccept = () => {
    if (calculatedTerms) {
      onAccept({
        loanAmount,
        repaymentStatus: 'Unpaid',
        ...calculatedTerms,
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 text-green-600">
                <CheckCircle className="h-6 w-6" />
                <CardTitle className="text-2xl">Congratulations! You're Eligible</CardTitle>
            </div>
          <CardDescription>{product.name} Offer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Loan Offer</AlertTitle>
            <AlertDescription>
              Based on our assessment, you can apply for a loan between{' '}
              <strong className="text-primary">{formatCurrency(suggestedLoanAmountMin)}</strong> and{' '}
              <strong className="text-primary">{formatCurrency(suggestedLoanAmountMax)}</strong>.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Label htmlFor="loanAmount" className="text-lg font-medium">Select Your Loan Amount</Label>
            <div className="flex items-center gap-4">
              <Input
                id="loanAmount"
                type="number"
                value={loanAmount}
                className="w-48 text-xl font-bold"
                readOnly
              />
               <Slider
                value={[loanAmount]}
                onValueChange={(value) => setLoanAmount(value[0])}
                min={suggestedLoanAmountMin}
                max={suggestedLoanAmountMax}
                step={(suggestedLoanAmountMax - suggestedLoanAmountMin) / 100}
              />
            </div>
          </div>

          {calculatedTerms && (
             <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm bg-secondary p-4 rounded-lg">
                <div className="font-medium">Service Fee (1.5%)</div>
                <div className="text-right">{formatCurrency(calculatedTerms.serviceFee)}</div>
                
                <div className="font-medium">Interest Rate</div>
                <div className="text-right">{calculatedTerms.interestRate.toFixed(2)}%</div>
                
                <div className="font-medium">Due Date</div>
                <div className="text-right">{format(calculatedTerms.dueDate, 'PPP')}</div>
                
                <div className="font-medium text-destructive">Penalty on late payment</div>
                <div className="text-right text-destructive">{formatCurrency(calculatedTerms.penaltyAmount)}</div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button size="lg" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleAccept}>
            Accept and Disburse Loan
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
