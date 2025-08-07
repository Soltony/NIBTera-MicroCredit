
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { LoanProvider, LoanProduct, LoanDetails } from '@/lib/types';

import { Building2, Landmark, Briefcase, Home, PersonStanding, ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/icons';
import { ProductSelection } from '@/components/loan/product-selection';
import { LoanOfferAndCalculator } from '@/components/loan/loan-offer-and-calculator';
import { LoanDetailsView } from '@/components/loan/loan-details-view';
import { Button } from '@/components/ui/button';
import { useLoanHistory } from '@/hooks/use-loan-history';
import { useLoanProviders } from '@/hooks/use-loan-providers';

type Step = 'calculator' | 'details';

export default function ApplyPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { addLoan } = useLoanHistory();
  const { providers: mockProviders } = useLoanProviders();
  
  const providerId = searchParams.get('providerId');
  const selectedProvider = mockProviders.find(p => p.id === providerId) || null;

  // State restoration from URL
  const initialStep: Step = searchParams.get('step') as Step || 'calculator';
  const initialProductId = searchParams.get('product');

  const [step, setStep] = useState<Step>(initialStep);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(() => selectedProvider?.products.find(p => p.id === initialProductId) || null);
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);

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

  useEffect(() => {
    // If the product is not selected, or the step is already details, do nothing.
    if (!selectedProduct || step === 'details') return;

    // This handles the case where the component is rendered on the server with one product
    // and then the client hydrates with a different product from the URL.
    const productFromUrl = selectedProvider?.products.find(p => p.id === initialProductId);
    if (productFromUrl && productFromUrl.id !== selectedProduct.id) {
      setSelectedProduct(productFromUrl);
    }
  }, [initialProductId, selectedProvider, selectedProduct, step]);

  const updateUrl = (newStep: Step, params: Record<string, string> = {}) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('step', newStep);
    Object.entries(params).forEach(([key, value]) => {
      if (value) newParams.set(key, value);
      else newParams.delete(key);
    });
    router.push(`${pathname}?${newParams.toString()}`);
  }
  
  const handleLoanAccept = (details: Omit<LoanDetails, 'id' | 'providerName' | 'productName' | 'payments'>) => {
    if (selectedProvider && selectedProduct) {
      const finalDetails: Omit<LoanDetails, 'id'> = {
        ...details,
        providerName: selectedProvider.name,
        productName: selectedProduct.name,
        payments: [],
      };
      addLoan(finalDetails);
      // We don't have the full loan details with ID yet from addLoan, so we create a temporary one for display
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
      // Use replace instead of push to prevent going back to the calculator
      router.replace(`${pathname}?${newParams.toString()}`);
    }
  };

  const handleBack = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('product');
    params.delete('step');

    if (step === 'details') {
      // From the success page, back should always go to the dashboard
      router.push(`/dashboard?${params.toString()}`);
    } else {
       router.push(`/dashboard?${params.toString()}`);
    }
  };

  const handleReset = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('product');
    params.delete('step');
    router.push(`/dashboard?${params.toString()}`);
  };
  
  const renderStep = () => {
    if (!selectedProvider) {
        return <div className="text-center">Provider not found. Please <a href="/" className="underline" style={{color: 'hsl(var(--primary))'}}>start over</a>.</div>
    }

    // Set product on initial render
    if (!selectedProduct) {
      const product = selectedProvider.products.find(p => p.id === initialProductId);
      if (product) {
        setSelectedProduct(product);
      } else {
        return <div className="text-center">Product not found. Please <a href="/" className="underline" style={{color: 'hsl(var(--primary))'}}>start over</a>.</div>
      }
    }
    
    switch (step) {
      case 'calculator':
        return selectedProduct && <LoanOfferAndCalculator product={selectedProduct} isLoading={false} eligibilityResult={eligibilityResult} onAccept={handleLoanAccept} providerColor={selectedProvider.colorHex} />;
      case 'details':
        return loanDetails && <LoanDetailsView details={loanDetails} onReset={handleReset} providerColor={selectedProvider.colorHex} />;
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
          <div className="flex flex-1 items-center justify-end space-x-4">
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
