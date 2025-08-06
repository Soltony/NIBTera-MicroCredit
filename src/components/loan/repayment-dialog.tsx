
'use client';

import { useState, useMemo } from 'react';
import type { LoanDetails } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Delete } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

interface RepaymentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (amount: number) => void;
    loan: LoanDetails;
    providerColor?: string;
}

export function RepaymentDialog({ isOpen, onClose, onConfirm, loan, providerColor = '#fdb913' }: RepaymentDialogProps) {
    const [amount, setAmount] = useState('');

    const totalAmountToRepay = useMemo(() => {
        const principal = loan.loanAmount;
        const serviceFee = loan.serviceFee;
        const now = new Date();
        const dueDate = loan.dueDate;

        // Daily fee is 0.2% of loan amount, interestRate is used for this
        const dailyFeeRate = loan.interestRate / 100 / 30; // Assuming interestRate is monthly
        const daysSinceLoan = differenceInDays(now, new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000));
        const dailyFees = principal * dailyFeeRate * Math.max(0, daysSinceLoan);

        const penalty = now > dueDate ? loan.penaltyAmount : 0;
        
        return principal + serviceFee + dailyFees + penalty;
    }, [loan]);

    const remainingAmount = useMemo(() => {
        const enteredAmount = parseFloat(amount) || 0;
        return totalAmountToRepay - enteredAmount;
    }, [amount, totalAmountToRepay]);

    const handleNumberClick = (num: string) => {
        if (num === '.' && amount.includes('.')) return;
        setAmount(prev => prev + num);
    };

    const handleBackspace = () => {
        setAmount(prev => prev.slice(0, -1));
    };

    const handleConfirm = () => {
        const numericAmount = parseFloat(amount);
        if (!isNaN(numericAmount) && numericAmount > 0) {
            onConfirm(numericAmount);
        }
    };

    const numberPadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md p-0" onPointerDownOutside={(e) => e.preventDefault()}>
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent"
                    style={{ color: providerColor }}
                >
                    <X className="h-6 w-6" />
                    <span className="sr-only">Close</span>
                </button>
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-center text-xl">Set Amount</DialogTitle>
                </DialogHeader>
                <div className="px-6 space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            readOnly
                            value={amount}
                            placeholder="0.00"
                            className="w-full text-center text-4xl font-bold border-b-2 py-2 bg-transparent outline-none"
                            style={{ borderColor: providerColor }}
                        />
                         <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground">USD</span>
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                        <p>Total amount to be repaid: {formatCurrency(totalAmountToRepay)}</p>
                        <p>Remaining amount: {formatCurrency(remainingAmount)}</p>
                    </div>
                </div>
                 <div className="grid grid-cols-4 gap-px bg-border rounded-b-lg overflow-hidden mt-4">
                    <div className="col-span-3 grid grid-cols-3 grid-rows-4 gap-px">
                        {numberPadKeys.map(key => (
                            <Button
                                key={key}
                                variant="ghost"
                                className="h-16 text-2xl rounded-none bg-background"
                                onClick={() => handleNumberClick(key)}
                            >
                                {key}
                            </Button>
                        ))}
                         <Button
                            variant="ghost"
                            className="h-16 text-2xl rounded-none bg-background col-span-2"
                            onClick={() => handleNumberClick('0')}
                        >
                            0
                        </Button>
                        <Button
                            variant="ghost"
                            className="h-16 text-2xl rounded-none bg-background"
                            onClick={() => handleNumberClick('.')}
                        >
                            .
                        </Button>
                    </div>
                    <div className="col-span-1 grid grid-rows-4 gap-px">
                         <Button
                                variant="ghost"
                                className="h-16 text-2xl rounded-none bg-background"
                                onClick={handleBackspace}
                            >
                            <Delete className="h-7 w-7" />
                        </Button>
                        <Button
                            className="h-full text-2xl rounded-none text-primary-foreground row-span-3"
                            onClick={handleConfirm}
                            style={{ backgroundColor: providerColor }}
                        >
                            OK
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
