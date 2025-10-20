
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { LoanProduct, LoanDetails, FeeRule, Tax } from '@/lib/types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00 ETB';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ETB';
};

const formatFee = (feeRule: FeeRule | undefined, suffix?: string): string => {
    if (!feeRule || feeRule.value === '' || feeRule.value === null) return 'N/A';
    const numericValue = Number(feeRule.value);
    if (isNaN(numericValue)) return 'N/A';

    if (feeRule.type === 'percentage') {
        return `${numericValue}%${suffix || ''}`;
    }
    return formatCurrency(numericValue);
};

interface ProductCardProps {
    product: LoanProduct;
    taxConfig: Tax | null;
    providerColor?: string;
    activeLoan?: LoanDetails;
    onApply: () => void;
    onRepay: (loan: LoanDetails, balanceDue: number) => void;
    IconDisplayComponent: React.ComponentType<{ iconName: string, className?: string }>;
    isEligible: boolean;
    eligibilityReason: string;
    availableToBorrow: number;
}

export function ProductCard({ 
    product, 
    taxConfig,
    providerColor = '#fdb913', 
    activeLoan, 
    onApply, 
    onRepay, 
    IconDisplayComponent,
    isEligible,
    eligibilityReason,
    availableToBorrow
}: ProductCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const isOverdue = activeLoan ? new Date() > new Date(activeLoan.dueDate) : false;

    const balanceDue = useMemo(() => {
        if (!activeLoan) return 0;
        const { total } = calculateTotalRepayable(activeLoan, activeLoan.product, taxConfig, new Date());
        const remainingBalance = total - (activeLoan.repaidAmount || 0);
        return Math.max(0, remainingBalance);
    }, [activeLoan, taxConfig]);

    const trueAvailableLimit = useMemo(() => {
        // The available limit for this specific product is the smaller of the product's general
        // available limit and the user's overall available credit.
        return Math.min(product.availableLimit || 0, availableToBorrow);
    }, [product.availableLimit, availableToBorrow]);


    const applyButton = (
        <Button 
            onClick={onApply} 
            style={{ backgroundColor: providerColor }} 
            className="text-white"
            disabled={!isEligible || availableToBorrow <= 0}
        >
            Apply
        </Button>
    );

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
                             <div className="flex items-center text-sm text-muted-foreground mt-1">
                                <span>Credit Limit: {formatCurrency(product.minLoan ?? 0)} - {formatCurrency(product.maxLoan ?? 0)}</span>
                                {product.duration && <span className="mx-2">•</span>}
                                {product.duration && <span>{product.duration} days</span>}
                            </div>
                        </div>
                    </div>
                     <div className="flex items-center">
                        {!activeLoan && (
                             !isEligible ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span tabIndex={0}>{applyButton}</span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{eligibilityReason}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                applyButton
                            )
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
                            <Button onClick={() => onRepay(activeLoan, balanceDue)} style={{ backgroundColor: providerColor }} className="text-white">Repay</Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center pt-4 border-t">
                            {Number(product.serviceFee?.value) ? (
                                <div>
                                    <p className="text-lg font-semibold">{formatFee(product.serviceFee)}</p>
                                    <p className="text-xs text-muted-foreground">Service Fee</p>
                                </div>
                            ) : null}
                             {Number(product.dailyFee?.value) ? (
                                <div>
                                    <p className="text-lg font-semibold">{formatFee(product.dailyFee, ' daily')}</p>
                                    <p className="text-xs text-muted-foreground">Daily Fee</p>
                                </div>
                            ) : null}
                            {product.penaltyRules?.length > 0 && (
                                <div>
                                    <p className="text-lg font-semibold">{`${product.penaltyRules.length} rule(s)`}</p>
                                    <p className="text-xs text-muted-foreground">Penalty Rules</p>
                                </div>
                            )}
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
                           {Number(product.serviceFee?.value) ? (
                                <div>
                                    <p className="text-lg font-semibold">{formatFee(product.serviceFee)}</p>
                                    <p className="text-xs text-muted-foreground">Service Fee</p>
                                </div>
                           ) : null}
                            {Number(product.dailyFee?.value) ? (
                                <div>
                                    <p className="text-lg font-semibold">{formatFee(product.dailyFee, ' daily')}</p>
                                    <p className="text-xs text-muted-foreground">Daily Fee</p>
                                </div>
                            ) : null}
                            {product.penaltyRules?.length > 0 && (
                                <div>
                                    <p className="text-lg font-semibold">{`${product.penaltyRules.length} rule(s)`}</p>
                                    <p className="text-xs text-muted-foreground">Penalty Rules</p>
                                </div>
                            )}
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
