
'use client';

import { useState, useMemo } from 'react';
import type { LoanDetails } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { XIcon, Delete } from 'lucide-react';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

interface RepaymentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (amount: number) => void;
    loan: LoanDetails;
}

export function RepaymentDialog({ isOpen, onClose, onConfirm, loan }: RepaymentDialogProps) {
    const [amount, setAmount] = useState('');

    const totalAmountToRepay = useMemo(() => {
        const principal = loan.loanAmount;
        const interest = loan.loanAmount * (loan.interestRate / 100);
        const fee = loan.serviceFee;
        const penalty = new Date() > loan.dueDate ? loan.penaltyAmount : 0;
        return principal + interest + fee + penalty;
    }, [loan]);

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
                            className="w-full text-center text-4xl font-bold border-b-2 border-primary py-2 bg-transparent outline-none"
                        />
                         <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground">USD</span>
                    </div>
                    <p className="text-center text-sm text-muted-foreground">
                        Total amount to be repaid: {formatCurrency(totalAmountToRepay)}
                    </p>
                </div>
                 <div className="grid grid-cols-4 gap-px bg-border rounded-b-lg overflow-hidden mt-4">
                    <div className="col-span-3 grid grid-cols-3 grid-rows-4 gap-px">
                        {numberPadKeys.map(key => (
                            <Button
                                key={key}
                                variant="ghost"
                                className="h-20 text-2xl rounded-none bg-background hover:bg-muted"
                                onClick={() => handleNumberClick(key)}
                            >
                                {key}
                            </Button>
                        ))}
                         <Button
                            variant="ghost"
                            className="h-20 text-2xl rounded-none bg-background hover:bg-muted col-span-2"
                            onClick={() => handleNumberClick('0')}
                        >
                            0
                        </Button>
                        <Button
                            variant="ghost"
                            className="h-20 text-2xl rounded-none bg-background hover:bg-muted"
                            onClick={() => handleNumberClick('.')}
                        >
                            .
                        </Button>
                    </div>
                    <div className="col-span-1 grid grid-rows-2 gap-px">
                         <Button
                                variant="ghost"
                                className="h-full text-2xl rounded-none bg-background hover:bg-muted"
                                onClick={handleBackspace}
                            >
                            <Delete className="h-7 w-7" />
                        </Button>
                        <Button
                            className="h-full text-2xl rounded-none bg-green-500 hover:bg-green-600 text-white"
                            onClick={handleConfirm}
                        >
                            OK
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
