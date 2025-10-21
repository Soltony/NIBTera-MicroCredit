
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { LoanProduct, LoanDetails, FeeRule, Tax, PenaltyRule } from '@/lib/types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

const formatFee = (feeRule: FeeRule | undefined, suffix?: string): string => {
    if (!feeRule || feeRule.value === '' || feeRule.value === null) return 'N/A';
    const numericValue = Number(feeRule.value);
    if (isNaN(numericValue)) return 'N/A';

    if (feeRule.type === 'percentage') {
        return `${numericValue}%${suffix || ''}`;
    }
    return formatCurrency(numericValue) + ' ETB';
};

const formatPenaltyRule = (rule: PenaltyRule | undefined, type: 'summary' | 'full' = 'full'): string => {
    if (!rule || rule.value === '' || rule.value === null) return 'N/A';
    const value = Number(rule.value);
    if (isNaN(value)) return 'N/A';

    let valueString = '';
    if (rule.type === 'fixed') {
        valueString = formatCurrency(value) + ' ETB';
    } else {
        valueString = `${value}%`;
    }

    if (type === 'summary') {
        return `${valueString} ${rule.frequency || 'daily'}`;
    }

    let conditionString = '';
    if (rule.type === 'percentageOfPrincipal') {
        valueString += ' of principal';
    } else if (rule.type === 'percentageOfCompound') {
        valueString += ' of outstanding';
    }
    
    const fromDay = rule.fromDay === '' ? 1 : Number(rule.fromDay);
    const toDay = rule.toDay === '' || rule.toDay === null ? Infinity : Number(rule.toDay);

    if (toDay === Infinity) {
        conditionString = ` from day ${fromDay} onwards`;
    } else {
        conditionString = ` from day ${fromDay} to day ${toDay}`;
    }

    return `${valueString}${conditionString}`;
}

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

    const maxPenaltyRule = useMemo(() => {
        if (!product.penaltyRules || product.penaltyRules.length === 0) return undefined;
        return product.penaltyRules.reduce((maxRule, currentRule) => {
            const maxValue = Number(maxRule.value) || 0;
            const currentValue = Number(currentRule.value) || 0;
            return currentValue > maxValue ? currentRule : maxRule;
        }, product.penaltyRules[0]);
    }, [product.penaltyRules]);


    const applyButton = (
        <Button 
            onClick={onApply} 
            style={{ backgroundColor: `${providerColor}20`, color: providerColor, borderColor: providerColor }} 
            className="text-white border"
            size="sm"
            variant="outline"
            disabled={!isEligible || availableToBorrow <= 0}
        >
            Apply
        </Button>
    );

    if (activeLoan) {
        return (
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-lg font-bold" style={{ color: providerColor }}>{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                                Due Date: {format(activeLoan.dueDate, 'yyyy-MM-dd')}
                                {isOverdue && <span className="text-red-500 ml-2 font-semibold">Overdue</span>}
                            </p>
                        </div>
                        <div className="text-right">
                             <p className="text-xl font-bold">{formatCurrency(balanceDue)}</p>
                             <p className="text-xs text-muted-foreground">Outstanding</p>
                        </div>
                    </div>
                     <div className="flex justify-end mt-2">
                        <Button onClick={() => onRepay(activeLoan, balanceDue)} style={{ backgroundColor: providerColor }} className="text-white">Repay</Button>
                    </div>
                </CardContent>
            </Card>
        );
    }
    

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <IconDisplayComponent iconName={product.icon} className="h-6 w-6" style={{ color: providerColor }} />
                        <div>
                            <p className="font-semibold">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                                Credit limit {formatCurrency(product.minLoan ?? 0)} to {formatCurrency(product.maxLoan ?? 0)}
                            </p>
                        </div>
                    </div>
                     {!isEligible ? (
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
                    )}
                </div>
                 <div className="flex justify-end mt-2">
                     <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center text-xs text-muted-foreground hover:text-primary">
                        More
                        {isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                    </button>
                </div>
                {isExpanded && (
                    <div className="bg-muted/50 p-3 rounded-lg mt-2 text-xs text-muted-foreground space-y-1">
                        {Number(product.serviceFee?.value) > 0 && (
                             <div className="flex justify-between items-center">
                                <span>Service Fee:</span>
                                <span>{formatFee(product.serviceFee)}</span>
                            </div>
                        )}
                        {Number(product.dailyFee?.value) > 0 && (
                            <div className="flex justify-between items-center">
                                <span>Daily Fee:</span>
                                <span>{formatFee(product.dailyFee, ' daily')}</span>
                            </div>
                        )}
                        {product.penaltyRules.length > 0 && (
                             <div className="flex justify-between items-center">
                                <span>Penalty:</span>
                                <span>{formatPenaltyRule(maxPenaltyRule, 'summary')}</span>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
