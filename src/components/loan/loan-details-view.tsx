
'use client';

import type { LoanDetails, LoanProduct } from '@/lib/types';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface LoanDetailsViewProps {
  details: LoanDetails;
  product: LoanProduct;
  onReset: () => void;
  providerColor?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function LoanDetailsView({ details, product, onReset, providerColor = 'hsl(var(--primary))' }: LoanDetailsViewProps) {
  return (
    <div className="max-w-2xl mx-auto">
       <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl" style={{color: providerColor}}>Loan Disbursed Successfully!</h1>
        <p className="text-lg text-muted-foreground mt-2">Here is a summary of your new loan.</p>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{details.productName}</CardTitle>
          <CardDescription>from {details.providerName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-baseline p-4 bg-secondary rounded-lg">
            <span className="text-muted-foreground">Loan Amount</span>
            <span className="text-5xl font-bold" style={{color: providerColor}}>{formatCurrency(details.loanAmount)}</span>
          </div>

          <Separator />
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div className="text-muted-foreground">Repayment Status</div>
            <div className="text-right font-medium">
              <Badge variant={details.repaymentStatus === 'Unpaid' ? 'destructive' : 'default'}>
                {details.repaymentStatus}
              </Badge>
            </div>
            
            <div className="text-muted-foreground">Service Fee Applied</div>
            <div className="text-right font-medium">{formatCurrency(details.serviceFee)}</div>

            <div className="text-muted-foreground">Daily Fee Rule</div>
            <div className="text-right font-medium">
                {product.dailyFee.value ? `${product.dailyFee.value}${product.dailyFee.type === 'percentage' ? '%' : ''}` : 'N/A'}
            </div>
            
            <div className="text-muted-foreground">Penalty Rules</div>
            <div className="text-right font-medium">
                {product.penaltyRules.length > 0 ? `${product.penaltyRules.length} rule(s) apply` : 'N/A'}
            </div>

            <div className="text-muted-foreground">Due Date</div>
            <div className="text-right font-medium">{format(details.dueDate, 'PPP')}</div>
            
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full text-white" onClick={onReset} style={{backgroundColor: providerColor}}>
            Start New Application
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
