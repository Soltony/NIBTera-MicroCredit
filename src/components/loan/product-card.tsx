'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { LoanProduct, LoanDetails } from '@/lib/types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { calculateTotalRepayable } from '@/lib/types';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const formatFee = (fee: string | undefined, suffix: string) => {
    if (!fee) return 'N/A';
    if (fee.includes('%') || fee.toLowerCase().includes('daily')) {
        return fee;
    }
    return `${fee}${suffix}`;
}

interface ProductCardProps {
    product: LoanProduct;
    providerColor?: string;
    activeLoan?: LoanDetails;
    onApply: () => void;
    onRepay: (loan: LoanDetails) => void;
    IconDisplayComponent: React.ComponentType<{ iconName: string, className?: string }>;
}

export function ProductCard({ product, providerColor = '#fdb913', activeLoan, onApply, onRepay, IconDisplayComponent }: ProductCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const isOverdue = activeLoan ? new Date() > new Date(activeLoan.dueDate) : false;

    const balanceDue = useMemo(() => {
        if (!activeLoan) return 0;
        const totalDebt = calculateTotalRepayable(activeLoan, new Date());
        const remainingBalance = totalDebt - (activeLoan.repaidAmount || 0);
        // Return 0 if the balance is negative (overpayment)
        return Math.max(0, remainingBalance);
    }, [activeLoan]);

    const canApply = (product.availableLimit ?? 0) > 0 && !activeLoan;

    return (
        <Card className="hover:shadow-lg transition-all duration-300">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full" style={{ backgroundColor: providerColor }}>
                            <IconDisplayComponent iconName={product.icon} className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{product.name}</CardTitle>
                             <span className="block text-sm text-muted-foreground mt-1">
                                Credit Limit: {formatCurrency(product.minLoan ?? 0)} - {formatCurrency(product.maxLoan ?? 0)}
                            </span>
                        </div>
                    </div>
                     <div className="flex items-center">
                        {!activeLoan && (
                            <Button 
                                onClick={onApply} 
                                style={{ backgroundColor: providerColor }} 
                                className="text-white"
                                disabled={!canApply}
                            >
                                Apply
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 {activeLoan && (
                    <div className="bg-muted/50 p-4 rounded-lg mt-2 mb-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-2xl font-bold">{formatCurrency(balanceDue)}</p>
                                <p className="text-sm text-muted-foreground">
                                    Due Date: {format(activeLoan.dueDate, 'yyyy-MM-dd')}
                                    {isOverdue && <span className="text-red-500 ml-2">Overdue</span>}
                                </p>
                            </div>
                            <Button onClick={() => onRepay(activeLoan)} style={{ backgroundColor: providerColor }} className="text-white">Repay</Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center pt-4 border-t">
                            <div>
                                <p className="text-lg font-semibold">{formatFee(product.serviceFee, '%')}</p>
                                <p className="text-xs text-muted-foreground">Service Fee</p>
                            </div>
                            <div>
                                <p className="text-lg font-semibold">{formatFee(product.dailyFee, '%')}</p>
                                <p className="text-xs text-muted-foreground">Daily Fee</p>
                            </div>
                            <div>
                                <p className="text-lg font-semibold">{formatFee(product.penaltyFee, '% daily')}</p>
                                <p className="text-xs text-muted-foreground">Penalty Fee After Due Date</p>
                            </div>
                             <div>
                                <p className="text-lg font-semibold">{formatCurrency(activeLoan.loanAmount)}</p>
                                <p className="text-xs text-muted-foreground">Loan Amount</p>
                            </div>
                        </div>
                    </div>
                )}
                {isExpanded && !activeLoan && (
                    <div className="bg-muted/50 p-4 rounded-lg mt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-lg font-semibold">{formatFee(product.serviceFee, '%')}</p>
                                <p className="text-xs text-muted-foreground">Service Fee</p>
                            </div>
                            <div>
                                <p className="text-lg font-semibold">{formatFee(product.dailyFee, '%')}</p>
                                <p className="text-xs text-muted-foreground">Daily Fee</p>
                            </div>
                            <div>
                                <p className="text-lg font-semibold">{formatFee(product.penaltyFee, '% daily')}</p>
                                <p className="text-xs text-muted-foreground">Penalty Fee After Due Date</p>
                            </div>
                            <div>
                                <p className="text-lg font-semibold">{formatCurrency(product.availableLimit ?? 0)}</p>
                                <p className="text-xs text-muted-foreground">Available Limit</p>
                            </div>
                        </div>
                    </div>
                )}
                {!activeLoan && (
                 <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex justify-center items-center mt-4 text-sm text-muted-foreground hover:text-primary">
                    {isExpanded ? 'Less' : 'More'}
                    {isExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                </button>
                )}
            </CardContent>
        </Card>
    );
}
