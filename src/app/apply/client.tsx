
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LoanProvider, LoanProduct, LoanDetails, Tax } from '@/lib/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { LoanOfferAndCalculator } from '@/components/loan/loan-offer-and-calculator';
import { LoanDetailsView } from '@/components/loan/loan-details-view';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import AccountSelector from '@/components/loan/account-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';


type Step = 'calculator' | 'details';

export function ApplyClient({ provider, taxConfigs }: { provider: LoanProvider, taxConfigs: Tax[] | null }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const productId = searchParams.get('product');
    const borrowerId = searchParams.get('borrowerId');

    const selectedProduct = useMemo(() => {
        if (!provider || !productId) return null;
        return provider.products.find(p => p.id === productId) || null;
    }, [provider, productId]);

    const initialStep: Step = searchParams.get('step') as Step || 'calculator';
    
    const [step, setStep] = useState<Step>(initialStep);
    const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
    const [showAccountModal, setShowAccountModal] = useState(false);

    useEffect(() => {
        // When the super-app provides a borrowerId (phone), check for an active associated account.
        // If none exists, open a blocking modal to force the user to select one.
        const checkActive = async () => {
            if (!borrowerId) return;
            try {
                const res = await fetch(`/api/phone-accounts?phoneNumber=${encodeURIComponent(borrowerId)}`);
                if (!res.ok) {
                    setShowAccountModal(true);
                    return;
                }
                const items = await res.json();
                const active = items && items.find((i: any) => i.isActive);
                if (active) {
                    setSelectedAccount(active);
                } else {
                    setShowAccountModal(true);
                }
            } catch (err) {
                setShowAccountModal(true);
            }
        };

        checkActive();
    }, [borrowerId]);

    const eligibilityResult = useMemo(() => {
        const min = searchParams.get('min');
        const max = searchParams.get('max');

        return {
            isEligible: true,
            suggestedLoanAmountMin: min ? parseFloat(min) : selectedProduct?.minLoan ?? 0,
            suggestedLoanAmountMax: max ? parseFloat(max) : selectedProduct?.maxLoan ?? 0,
            reason: 'You are eligible for a loan.',
        };
    }, [searchParams, selectedProduct]);

    const handleLoanAccept = async (details: Omit<LoanDetails, 'id' | 'providerName' | 'productName' | 'payments' >) => {
        if (!selectedProduct || !borrowerId) {
            toast({ title: 'Error', description: 'Missing required information.', variant: 'destructive'});
            return;
        }

        try {
            // Personal Loan Flow: Disburse the loan directly
            const finalDetails = {
                borrowerId,
                productId: selectedProduct.id,
                loanAmount: details.loanAmount,
                disbursedDate: details.disbursedDate,
                dueDate: details.dueDate,
            };

            const response = await fetch('/api/loans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalDetails),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save the loan.');
            }
            
            const savedLoan = await response.json();

            const displayLoan: LoanDetails = {
                ...savedLoan,
                providerName: provider.name,
                productName: selectedProduct.name,
                disbursedDate: new Date(savedLoan.disbursedDate),
                dueDate: new Date(savedLoan.dueDate),
                payments: [],
            }
            setLoanDetails(displayLoan);
            setStep('details');
                toast({
                title: 'Success!',
                description: 'Your loan has been successfully disbursed.',
            });

        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleBack = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('product');
        params.delete('step');
        router.push(`/loan?${params.toString()}`);
    };

    const handleReset = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('product');
        params.delete('step');
        router.push(`/loan?${params.toString()}`);
    };

    const renderStep = () => {
        switch (step) {
            case 'calculator':
                if (selectedProduct) {
                    return <LoanOfferAndCalculator product={selectedProduct} taxConfigs={taxConfigs || []} isLoading={false} eligibilityResult={eligibilityResult} onAccept={handleLoanAccept} providerColor={provider.colorHex} />;
                }
                if (productId && !selectedProduct) {
                        return <div className="text-center">Product not found. Please <button onClick={() => router.push('/loan')} className="underline" style={{color: 'hsl(var(--primary))'}}>start over</button>.</div>;
                }
                return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

            case 'details':
                if (loanDetails && selectedProduct) {
                    return <LoanDetailsView details={loanDetails} product={selectedProduct} onReset={handleReset} providerColor={provider.colorHex} />;
                }
                return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
            default:
                return <div className="text-center">Invalid step.</div>;
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <main className="flex-1">
                <div className="container py-8 md:py-12">
                    {/* If borrowerId is provided by the super-app, automatically show account selector */}
                    {/* Show selected account summary when available */}
                    {selectedAccount ? (
                        <div className="mb-6">
                            <div className="text-sm">Selected account for disbursement:</div>
                            <div className="font-mono">{selectedAccount.accountNumber} — {selectedAccount.customerName}</div>
                        </div>
                    ) : null}

                    {renderStep()}

                    {/* Blocking modal: forces account selection when there is no active account */}
                    <Dialog open={showAccountModal} onOpenChange={(open) => {
                        // prevent closing unless an account is selected
                        if (!open && !selectedAccount) return;
                        setShowAccountModal(open);
                    }}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Select disbursement account</DialogTitle>
                                <DialogDescription>Please choose the account to receive disbursements for this loan. This selection is required.</DialogDescription>
                            </DialogHeader>
                            {borrowerId && (
                                <div className="mt-4">
                                    <AccountSelector phoneNumber={borrowerId} onSelected={(acc) => {
                                        setSelectedAccount(acc);
                                        setShowAccountModal(false);
                                    }} />
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </main>
        </div>
    );
}
