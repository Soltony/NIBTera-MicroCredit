
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { LoanProvider, LoanProduct, LoanDetails } from '@/lib/types';

import { Building2, Landmark, Briefcase, Home, PersonStanding } from 'lucide-react';
import { Logo } from '@/components/icons';
import { ProductSelection } from '@/components/loan/product-selection';
import { LoanOfferAndCalculator } from '@/components/loan/loan-offer-and-calculator';
import { LoanDetailsView } from '@/components/loan/loan-details-view';
import { Button } from '@/components/ui/button';

const mockProviders: LoanProvider[] = [
  {
    id: 'provider-1',
    name: 'Capital Bank',
    icon: Building2,
    products: [
      { id: 'prod-1a', name: 'Personal Loan', description: 'Flexible personal loans for your needs.', icon: PersonStanding, minLoan: 400, maxLoan: 2000 },
      { id: 'prod-1b', name: 'Home Improvement Loan', description: 'Finance your home renovation projects.', icon: Home, minLoan: 10000, maxLoan: 50000 },
    ],
  },
  {
    id: 'provider-2',
    name: 'Providus Financial',
    icon: Landmark,
    products: [
      { id: 'prod-2a', name: 'Startup Business Loan', description: 'Kickstart your new business venture.', icon: Briefcase },
      { id: 'prod-2b', name: 'Personal Auto Loan', description: 'Get behind the wheel of your new car.', icon: PersonStanding },
    ],
  },
  {
    id: 'provider-3',
    name: 'FairMoney Group',
    icon: Building2,
    products: [
      { id: 'prod-3a', name: 'Quick Cash Loan', description: 'Instant cash for emergencies.', icon: PersonStanding },
      { id: 'prod-3b', name: 'Gadget Financing', description: 'Upgrade your devices with easy financing.', icon: Home },
    ],
  },
];

type Step = 'calculator' | 'details';

export default function ApplyPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const providerId = searchParams.get('providerId');
  const selectedProvider = mockProviders.find(p => p.id === providerId) || null;

  // State restoration from URL
  const initialStep: Step = 'calculator';
  const initialProductId = searchParams.get('product');

  const [step, setStep] = useState<Step>(initialStep);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(() => selectedProvider?.products.find(p => p.id === initialProductId) || null);
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);

  const eligibilityResult = useMemo(() => {
    if (!selectedProduct) {
        return {
            isEligible: false,
            reason: 'No product selected'
        }
    }
    let minLoan = selectedProduct.minLoan ?? 500;
    let maxLoan = selectedProduct.maxLoan ?? 50000;

    return {
        isEligible: true,
        suggestedLoanAmountMin: minLoan,
        suggestedLoanAmountMax: maxLoan,
        reason: 'You are eligible for a loan.'
    }
  }, [selectedProduct]);

  const updateUrl = (newStep: Step, params: Record<string, string> = {}) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('step', newStep);
    Object.entries(params).forEach(([key, value]) => {
      if (value) newParams.set(key, value);
      else newParams.delete(key);
    });
    router.push(`${pathname}?${newParams.toString()}`);
  }
  
  const handleLoanAccept = (details: Omit<LoanDetails, 'providerName' | 'productName'>) => {
    if (selectedProvider && selectedProduct) {
      const finalDetails = {
        ...details,
        providerName: selectedProvider.name,
        productName: selectedProduct.name,
      };
      setLoanDetails(finalDetails);
      setStep('details');
      const newParams = new URLSearchParams(searchParams);
      newParams.set('step', 'details');
      router.push(`${pathname}?${newParams.toString()}`);
    }
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep('calculator');
      updateUrl('calculator', { product: selectedProduct!.id });
    } else if (step === 'calculator') {
      router.push(`/dashboard?providerId=${providerId}`);
    }
  };

  const handleReset = () => {
    router.push('/');
  };
  
  const renderStep = () => {
    if (!selectedProvider) {
        return <div className="text-center">Provider not found. Please <a href="/" className="text-primary underline">start over</a>.</div>
    }
    switch (step) {
      case 'calculator':
        return selectedProduct && <LoanOfferAndCalculator product={selectedProduct} isLoading={false} eligibilityResult={eligibilityResult} onAccept={handleLoanAccept} />;
      case 'details':
        return loanDetails && <LoanDetailsView details={loanDetails} onReset={handleReset} />;
      default:
        return selectedProduct && <LoanOfferAndCalculator product={selectedProduct} isLoading={false} eligibilityResult={eligibilityResult} onAccept={handleLoanAccept} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-yellow-300/30 backdrop-blur supports-[backdrop-filter]:bg-yellow-300/30">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex">
            <a className="mr-6 flex items-center space-x-2" href="/">
              <Logo className="h-6 w-6" />
              <span className="font-bold">LoanFlow Mini</span>
            </a>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
             <Button variant="ghost" onClick={handleBack}>Back</Button>
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
