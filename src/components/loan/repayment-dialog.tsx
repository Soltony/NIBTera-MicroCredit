
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { LoanDetails, LoanProduct, Tax } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Delete, Loader2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertCircle } from 'lucide-react';

const formatCurrency = (amount: number) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ETB';
};

interface RepaymentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (amount: number) => void;
    loan: LoanDetails;
    totalBalanceDue: number;
    providerColor?: string;
    taxConfig: Tax | null;
}

// Extend the window type to include myJsChannel
declare global {
  interface Window {
    myJsChannel?: {
      postMessage: (message: any) => void;
    };
  }
}

export function RepaymentDialog({ isOpen, onClose, onConfirm, loan, totalBalanceDue, providerColor = '#fdb913', taxConfig }: RepaymentDialogProps) {
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setAmount(totalBalanceDue.toFixed(2));
            setError('');
            setIsProcessing(false);
        }
    }, [isOpen, totalBalanceDue]);

    const remainingAmount = useMemo(() => {
        const enteredAmount = parseFloat(amount) || 0;
        return totalBalanceDue - enteredAmount;
    }, [amount, totalBalanceDue]);

    const validateAmount = (value: string) => {
        const numericAmount = parseFloat(value);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError('Please enter a valid amount.');
            return false;
        }
        if (numericAmount > totalBalanceDue + 1e-9) { // Use a small epsilon for float comparison
            setError(`Amount cannot be more than the balance due of ${formatCurrency(totalBalanceDue)}.`);
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

    const handleConfirm = async () => {
        const numericAmount = parseFloat(amount);
        if (!validateAmount(amount) || isNaN(numericAmount)) {
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            // Step 1: Call our backend to get the payment token
            const initiateResponse = await fetch('/api/initiate-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: numericAmount, loanId: loan.id }),
            });

            if (!initiateResponse.ok) {
                const errorData = await initiateResponse.json();
                throw new Error(errorData.error || 'Failed to initiate payment.');
            }

            const { paymentToken, transactionId } = await initiateResponse.json();

            // Step 2: Post the payment token to the Super App via JS Channel
            if (typeof window !== 'undefined' && window.myJsChannel?.postMessage) {
              window.myJsChannel.postMessage({ token: paymentToken });
              
              // You might want to start polling for payment status here
              // For now, we will assume success and call the onConfirm callback
              // which will update the UI optimistically.
              
              toast({
                  title: 'Payment Sent',
                  description: 'Your payment request has been sent to the Super App for processing.',
              });

              // NOTE: In a real-world scenario, you would poll a 'check-status' endpoint
              // using the transactionId. Once confirmed, you would then call onConfirm.
              // For this implementation, we optimistically call onConfirm right away.
              onConfirm(numericAmount);

            } else {
              console.error("NIB Super App channel (window.myJsChannel) not found.");
              throw new Error("Could not communicate with the payment app.");
            }

        } catch (err: any) {
            setError(err.message || 'An unknown error occurred during payment.');
        } finally {
            setIsProcessing(false);
        }
    };

    const numberPadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    const breakdown = useMemo(() => {
        if (!loan || !loan.product) return { principal: 0, interest: 0, penalty: 0, serviceFee: 0 };
        return calculateTotalRepayable(loan, loan.product, taxConfig, new Date());
    }, [loan, taxConfig]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md p-0" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader className="p-6 pb-2 flex-row justify-between items-center">
                    <DialogTitle className="text-center text-xl flex-1">Set Amount</DialogTitle>
                    <DialogClose asChild>
                         <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-primary/10"
                            style={{'--primary': providerColor} as React.CSSProperties}
                        >
                            <X className="h-5 w-5" style={{ color: providerColor }}/>
                        </Button>
                    </DialogClose>
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
                         <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground">ETB</span>
                    </div>
                     {error ? (
                         <Alert variant="destructive" className="p-2 text-center">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                         </Alert>
                    ) : (
                        <div className="text-center text-sm text-muted-foreground space-y-1">
                            <div className="grid grid-cols-3 gap-2 text-xs text-left">
                                <span className="col-span-2">Principal Due:</span>
                                <span className="text-right font-medium text-foreground">{formatCurrency(breakdown.principal - (loan.repaidAmount || 0))}</span>
                                
                                <span className="col-span-2">Service Fee Due:</span>
                                <span className="text-right font-medium text-foreground">{formatCurrency(breakdown.serviceFee)}</span>

                                <span className="col-span-2">Interest Due:</span>
                                <span className="text-right font-medium text-foreground">{formatCurrency(breakdown.interest)}</span>

                                <span className="col-span-2">Penalty Due:</span>
                                <span className="text-right font-medium text-foreground">{formatCurrency(breakdown.penalty)}</span>
                            </div>
                            <p className="font-bold text-foreground">Total amount to be repaid: {formatCurrency(totalBalanceDue)}</p>
                            <p>Remaining after this payment: {formatCurrency(remainingAmount)}</p>
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
                            disabled={!!error || isProcessing}
                            style={{ backgroundColor: providerColor }}
                        >
                            {isProcessing ? <Loader2 className="h-8 w-8 animate-spin"/> : 'OK'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
