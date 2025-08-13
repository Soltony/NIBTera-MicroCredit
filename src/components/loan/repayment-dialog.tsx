

'use client';

import { useState, useMemo, useEffect } from 'react';
import type { LoanDetails } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Delete } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { calculateTotalRepayable } from '@/lib/types';

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
    const [error, setError] = useState('');

    const totalAmountToRepay = useMemo(() => {
        return calculateTotalRepayable(loan);
    }, [loan]);

    const balanceDue = useMemo(() => {
        return totalAmountToRepay - (loan.repaidAmount || 0);
    },[totalAmountToRepay, loan.repaidAmount]);


    useEffect(() => {
        if (isOpen) {
            setAmount(balanceDue.toFixed(2));
            setError('');
        }
    }, [isOpen, balanceDue]);

    const remainingAmount = useMemo(() => {
        const enteredAmount = parseFloat(amount) || 0;
        return balanceDue - enteredAmount;
    }, [amount, balanceDue]);

    const validateAmount = (value: string) => {
        const numericAmount = parseFloat(value);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError('Please enter a valid amount.');
            return false;
        }
        if (numericAmount > balanceDue) {
            setError(`Amount cannot be more than the balance due of ${formatCurrency(balanceDue)}.`);
            return false;
        }
        setError('');
        return true;
    }

    const handleNumberClick = (num: string) => {
        if (num === '.' && amount.includes('.')) return;
        const newAmount = amount + num;
        setAmount(newAmount);
        validateAmount(newAmount);
    };

    const handleBackspace = () => {
        const newAmount = amount.slice(0, -1);
        setAmount(newAmount);
        validateAmount(newAmount);
    };

    const handleConfirm = () => {
        const numericAmount = parseFloat(amount);
        if (validateAmount(amount) && !isNaN(numericAmount)) {
            onConfirm(numericAmount);
        }
    };

    const numberPadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md p-0" onPointerDownOutside={(e) => e.preventDefault()}>
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
                            className={cn(
                                "w-full text-center text-4xl font-bold border-b-2 py-2 bg-transparent outline-none",
                                error ? "border-destructive" : ""
                            )}
                            style={{ borderColor: error ? 'hsl(var(--destructive))' : providerColor }}
                        />
                         <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground">USD</span>
                    </div>
                     {error ? (
                        <p className="text-sm text-destructive text-center">{error}</p>
                    ) : (
                        <div className="text-center text-sm text-muted-foreground">
                            <p>Total amount to be repaid: {formatCurrency(balanceDue)}</p>
                            <p>Remaining amount: {formatCurrency(remainingAmount)}</p>
                        </div>
                    )}
                </div>
                 <div className="grid grid-cols-4 gap-px bg-border rounded-b-lg overflow-hidden mt-4">
                    <div className="col-span-3 grid grid-cols-3 grid-rows-4 gap-px">
                        {numberPadKeys.map(key => (
                            <Button
                                key={key}
                                variant="ghost"
                                className="h-16 text-2xl rounded-none bg-background hover:bg-primary/10"
                                onClick={() => handleNumberClick(key)}
                                style={{'--primary': providerColor} as React.CSSProperties}
                            >
                                {key}
                            </Button>
                        ))}
                         <Button
                            variant="ghost"
                            className="h-16 text-2xl rounded-none bg-background col-span-2 hover:bg-primary/10"
                            onClick={() => handleNumberClick('0')}
                            style={{'--primary': providerColor} as React.CSSProperties}
                        >
                            0
                        </Button>
                        <Button
                            variant="ghost"
                            className="h-16 text-2xl rounded-none bg-background hover:bg-primary/10"
                            onClick={() => handleNumberClick('.')}
                             style={{'--primary': providerColor} as React.CSSProperties}
                        >
                            .
                        </Button>
                    </div>
                    <div className="col-span-1 grid grid-rows-4 gap-px">
                         <Button
                                variant="ghost"
                                className="h-16 text-2xl rounded-none bg-background flex items-center justify-center hover:bg-primary/10"
                                onClick={handleBackspace}
                                style={{'--primary': providerColor} as React.CSSProperties}
                            >
                            <Delete className="h-7 w-7" />
                        </Button>
                        <Button
                            className="h-full text-2xl rounded-none text-primary-foreground row-span-3"
                            onClick={handleConfirm}
                            disabled={!!error}
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
