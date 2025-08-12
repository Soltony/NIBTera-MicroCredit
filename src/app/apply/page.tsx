
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { LoanProvider, LoanProduct, LoanDetails } from '@/lib/types';

import { ArrowLeft, Loader2 } from 'lucide-react';
import { LoanOfferAndCalculator } from '@/components/loan/loan-offer-and-calculator';
import { LoanDetailsView } from '@/components/loan/loan-details-view';
import { Button } from '@/components/ui/button';
import { useLoanHistory } from '@/hooks/use-loan-history';

type Step = 'calculator' | 'details';

function ApplyClient({ providers }: { providers: LoanProvider[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { addLoan } = useLoanHistory();

  const providerId = searchParams.get('providerId');
  const selectedProvider = providers.find(p => p.id === providerId) || null;

  const initialStep: Step = searchParams.get('step') as Step || 'calculator';
  const initialProductId = searchParams.get('product');

  const [step, setStep] = useState<Step>(initialStep);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(() => {
    if (!selectedProvider || !initialProductId) return null;
    return selectedProvider.products.find(p => p.id === initialProductId) || null;
  });
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);

  useEffect(() => {
    // This effect ensures that if the product ID changes in the URL (e.g. via navigation),
    // the component's state updates to reflect that new product.
    if (selectedProvider && initialProductId) {
      const productFromUrl = selectedProvider.products.find(p => p.id === initialProductId);
      if (productFromUrl) {
          setSelectedProduct(productFromUrl);
      } else {
          setSelectedProduct(null);
      }
    } else {
        setSelectedProduct(null);
    }
  }, [initialProductId, selectedProvider]);

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
  
  const handleLoanAccept = (details: Omit<LoanDetails, 'id' | 'providerName' | 'productName' | 'payments'>) => {
    if (selectedProvider && selectedProduct) {
      const finalDetails: Omit<LoanDetails, 'id'> = {
        ...details,
        providerName: selectedProvider.name,
        productName: selectedProduct.name,
        payments: [],
      };
      addLoan(finalDetails);
      const displayLoan: LoanDetails = {
          ...finalDetails,
          id: `temp-${Date.now()}`,
          repaidAmount: 0,
          payments: [],
      }
      setLoanDetails(displayLoan);
      setStep('details');
      const newParams = new URLSearchParams(searchParams);
      newParams.set('step', 'details');
      router.replace(`${pathname}?${newParams.toString()}`);
    }
  };

  const handleBack = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('product');
    params.delete('step');
    params.delete('min');
    params.delete('max');
    params.delete('error');
    router.push(`/dashboard?${params.toString()}`);
  };

  const handleReset = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('product');
    params.delete('step');
    params.delete('min');
    params.delete('max');
    params.delete('error');
    router.push(`/dashboard?${params.toString()}`);
  };
  
  const renderStep = () => {
    if (!providers || providers.length === 0) {
      return (
          <div className="flex flex-col min-h-screen bg-background items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Loading Providers...</h2>
            </div>
          </div>
      );
    }
      
    if (!selectedProvider) {
        return <div className="text-center">Provider not found. Please <a href="/" className="underline" style={{color: 'hsl(var(--primary))'}}>start over</a>.</div>
    }

    switch (step) {
      case 'calculator':
        if (selectedProduct) {
          return <LoanOfferAndCalculator product={selectedProduct} isLoading={false} eligibilityResult={eligibilityResult} onAccept={handleLoanAccept} providerColor={selectedProvider.colorHex} />;
        }
        // If there's a product ID in the URL but we couldn't find the product
        if(initialProductId && !selectedProduct) {
             return <div className="text-center">Product not found. Please <a href="/" className="underline" style={{color: 'hsl(var(--primary))'}}>start over</a>.</div>;
        }
        // If we are still waiting for the effect to run
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

      case 'details':
        if (loanDetails) {
          return <LoanDetailsView details={loanDetails} onReset={handleReset} providerColor={selectedProvider.colorHex} />;
        }
        // Fallback if details are not ready yet
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
      default:
         return <div className="text-center">Invalid step.</div>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b" style={{ backgroundColor: selectedProvider?.colorHex || 'hsl(var(--primary))' }}>
        <div className="container flex h-16 items-center">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2 text-primary-foreground hover:bg-white/20">
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-lg font-semibold tracking-tight text-primary-foreground">Loan Application</h1>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="container py-8 md:py-12">
          {renderStep()}
        </div>
      </main>
    </div>
  );
}


// This wrapper allows us to pass server-fetched data to the client component
export default function ApplyPageWrapper({ providers }: { providers: LoanProvider[] }) {
    if (!providers) {
        return (
            <div className="flex flex-col min-h-screen bg-background items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <h2 className="text-xl font-semibold">Loading Providers...</h2>
              </div>
            </div>
        );
    }
    return <ApplyClient providers={providers} />;
}
