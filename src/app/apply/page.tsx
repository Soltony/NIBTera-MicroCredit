
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

const mockProviders: LoanProvider[] = [
    {
    id: 'provider-3',
    name: 'NIb Bank',
    icon: Building2,
    color: 'text-yellow-500',
    colorHex: '#fdb913',
    products: [
      { id: 'prod-3a', name: 'Quick Cash Loan', description: 'Instant cash for emergencies.', icon: PersonStanding, minLoan: 500, maxLoan: 2500, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
      { id: 'prod-3b', name: 'Gadget Financing', description: 'Upgrade your devices with easy financing.', icon: Home, minLoan: 300, maxLoan: 1500, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
    ],
  },
  {
    id: 'provider-1',
    name: 'Capital Bank',
    icon: Building2,
    color: 'text-blue-600',
    colorHex: '#2563eb',
    products: [
      { id: 'prod-1a', name: 'Personal Loan', description: 'Flexible personal loans for your needs.', icon: PersonStanding, minLoan: 400, maxLoan: 2000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
      { id: 'prod-1b', name: 'Home Improvement Loan', description: 'Finance your home renovation projects.', icon: Home, minLoan: 10000, maxLoan: 50000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
    ],
  },
  {
    id: 'provider-2',
    name: 'Providus Financial',
    icon: Landmark,
    color: 'text-green-600',
    colorHex: '#16a34a',
    products: [
      { id: 'prod-2a', name: 'Startup Business Loan', description: 'Kickstart your new business venture.', icon: Briefcase, minLoan: 5000, maxLoan: 100000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
      { id: 'prod-2b', name: 'Personal Auto Loan', description: 'Get behind the wheel of your new car.', icon: PersonStanding, minLoan: 2000, maxLoan: 30000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
    ],
  },
];

type Step = 'calculator' | 'details';

export default function ApplyPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { addLoan } = useLoanHistory();
  
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
  
  const handleLoanAccept = (details: Omit<LoanDetails, 'providerName' | 'productName' | 'payments'>) => {
    if (selectedProvider && selectedProduct) {
      const finalDetails: LoanDetails = {
        ...details,
        providerName: selectedProvider.name,
        productName: selectedProduct.name,
        payments: [],
      };
      addLoan(finalDetails);
      setLoanDetails(finalDetails);
      setStep('details');
      const newParams = new URLSearchParams(searchParams);
      newParams.set('step', 'details');
      router.push(`${pathname}?${newParams.toString()}`);
    }
  };

  const handleBack = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('product');
    params.delete('step');

    if (step === 'details') {
      setStep('calculator');
      params.set('step', 'calculator');
      params.set('product', selectedProduct!.id);
      router.push(`${pathname}?${params.toString()}`);
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
