
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { LoanProduct, LoanDetails, CheckLoanEligibilityOutput, FeeRule, PenaltyRule } from '@/lib/types';
import { addDays, format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, Info, ChevronDown } from 'lucide-react';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';

interface LoanOfferAndCalculatorProps {
  product: LoanProduct;
  isLoading: boolean;
  eligibilityResult: CheckLoanEligibilityOutput | null;
  onAccept: (details: Omit<LoanDetails, 'id' | 'providerName' | 'productName' | 'payments' >) => void;
  providerColor?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const formatFee = (feeRule: FeeRule | undefined): string => {
    if (!feeRule || feeRule.value === '' || feeRule.value === 0) return 'N/A';
    if (feeRule.type === 'percentage') {
        return `${feeRule.value}%`;
    }
    return formatCurrency(Number(feeRule.value));
};

const formatPenaltyRule = (rule: PenaltyRule): string => {
    const value = rule.value === '' ? 0 : Number(rule.value);
    let valueString = '';
    let conditionString = '';

    if (rule.type === 'fixed') {
        valueString = formatCurrency(value);
    } else if (rule.type === 'percentageOfPrincipal') {
        valueString = `${value}% of principal`;
    } else if (rule.type === 'percentageOfCompound') {
        valueString = `${value}% of outstanding balance`;
    }
    
    const fromDay = rule.fromDay === '' ? 1 : Number(rule.fromDay);
    const toDay = rule.toDay === '' || rule.toDay === null ? Infinity : Number(rule.toDay);

    if (toDay === Infinity) {
        conditionString = `from day ${fromDay} onwards`;
    } else {
        conditionString = `from day ${fromDay} to day ${toDay}`;
    }

    return `${valueString} ${conditionString}`;
}


export function LoanOfferAndCalculator({ product, isLoading, eligibilityResult, onAccept, providerColor = 'hsl(var(--primary))' }: LoanOfferAndCalculatorProps) {
  const [loanAmount, setLoanAmount] = useState<number | string>('');
  const [amountError, setAmountError] = useState('');
  const [isPenaltyDetailsOpen, setIsPenaltyDetailsOpen] = useState(false);

  const { suggestedLoanAmountMin = 0, suggestedLoanAmountMax = 0 } = eligibilityResult || {};
  
  const minLoan = product.minLoan ?? 0;
  // The true max loan is the lesser of the product's limit and the user's available credit.
  const maxLoan = Math.min(product.maxLoan ?? 0, suggestedLoanAmountMax);

  useEffect(() => {
    // Set the initial amount to the product's min, but not exceeding the true max loan.
    const initialAmount = Math.min(minLoan, maxLoan);
    setLoanAmount(initialAmount);
  }, [product.id, minLoan, maxLoan]);
  
  const calculatedTerms = useMemo(() => {
    const numericLoanAmount = typeof loanAmount === 'string' ? parseFloat(loanAmount) : loanAmount;
    if (!eligibilityResult?.isEligible || isNaN(numericLoanAmount) || numericLoanAmount <= 0) return null;
    
    const disbursedDate = new Date();
    const dueDate = addDays(disbursedDate, product.duration || 30);
    
    let serviceFee = 0;
    if (product.serviceFeeEnabled && product.serviceFee && product.serviceFee.value) {
        const feeValue = typeof product.serviceFee.value === 'string' ? parseFloat(product.serviceFee.value) : product.serviceFee.value;
        serviceFee = product.serviceFee.type === 'fixed' 
            ? feeValue
            : numericLoanAmount * (feeValue / 100);
    }
    
    // Create a temporary loan object to pass to the calculation function.
    const tempLoan: LoanDetails = {
        id: 'temp',
        loanAmount: numericLoanAmount,
        serviceFee: serviceFee,
        disbursedDate,
        dueDate,
        repaymentStatus: 'Unpaid',
        payments: [],
        productName: product.name,
        providerName: '',
        repaidAmount: 0,
        penaltyAmount: 0,
    };
    
    const totalRepayable = calculateTotalRepayable(tempLoan, product, dueDate);

    return { serviceFee, disbursedDate, dueDate, totalRepayable, penaltyAmount: 0 };
  }, [loanAmount, eligibilityResult, product]);

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
             <div className="space-y-2">
                <div className="space-y-4 text-sm bg-secondary p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div className="font-medium">Service Fee</div>
                      <div className="text-right">{formatFee(product.serviceFeeEnabled ? product.serviceFee : undefined)}</div>
                    </div>
                    
                     <div className="flex justify-between items-center">
                        <div className="font-medium">Daily Fee</div>
                        <div className="text-right">{formatFee(product.dailyFeeEnabled ? product.dailyFee : undefined)}</div>
                    </div>
                    
                    <Collapsible open={isPenaltyDetailsOpen} onOpenChange={setIsPenaltyDetailsOpen}>
                        <CollapsibleTrigger asChild>
                            <button type="button" className={cn("font-medium w-full flex justify-between items-center", product.penaltyRulesEnabled && product.penaltyRules.length > 0 && "text-destructive")}>
                                <span className="flex items-center">
                                Penalty Rules
                                {product.penaltyRulesEnabled && product.penaltyRules.length > 0 && <ChevronDown className={cn("h-4 w-4 ml-1 transition-transform", isPenaltyDetailsOpen && "rotate-180")} />}
                                </span>
                                 <span className={cn("text-right text-muted-foreground", product.penaltyRulesEnabled && product.penaltyRules.length > 0 && "text-destructive")}>
                                    {product.penaltyRulesEnabled && product.penaltyRules.length > 0 ? '' : 'N/A'}
                                </span>
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground/80 pl-4">
                                {(product.penaltyRules || []).map(rule => (
                                    <p key={rule.id}>- {formatPenaltyRule(rule)}</p>
                                ))}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
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
