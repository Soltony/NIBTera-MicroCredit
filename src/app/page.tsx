'use client';

import { useState } from 'react';
import type { LoanProvider, LoanProduct, LoanDetails, CheckLoanEligibilityOutput } from '@/lib/types';
import { checkLoanEligibility } from '@/ai/flows/loan-eligibility-check';

import { Building2, Landmark, Briefcase, Home as HomeIcon, PersonStanding } from 'lucide-react';
import { Logo } from '@/components/icons';
import { ProviderSelection } from '@/components/loan/provider-selection';
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
      { id: 'prod-1a', name: 'Personal Loan', description: 'Flexible personal loans for your needs.', icon: PersonStanding },
      { id: 'prod-1b', name: 'Home Improvement Loan', description: 'Finance your home renovation projects.', icon: HomeIcon },
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
      { id: 'prod-3b', name: 'Gadget Financing', description: 'Upgrade your devices with easy financing.', icon: HomeIcon },
    ],
  },
];

const mockUserData = {
  creditScore: 720,
  annualIncome: 65000,
};

type Step = 'provider' | 'product' | 'calculator' | 'details';

export default function HomePage() {
  const [step, setStep] = useState<Step>('provider');
  const [selectedProvider, setSelectedProvider] = useState<LoanProvider | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
  const [eligibilityResult, setEligibilityResult] = useState<CheckLoanEligibilityOutput | null>(null);
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleProviderSelect = (provider: LoanProvider) => {
    setSelectedProvider(provider);
    setStep('product');
  };

  const handleProductSelect = async (product: LoanProduct) => {
    setSelectedProduct(product);
    setStep('calculator');
    setIsLoading(true);
    try {
      const result = await checkLoanEligibility(mockUserData);
      setEligibilityResult(result);
    } catch (error) {
      console.error('Eligibility Check Failed:', error);
      setEligibilityResult({ isEligible: false, reason: 'An error occurred while checking eligibility.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoanAccept = (details: Omit<LoanDetails, 'providerName' | 'productName'>) => {
    if (selectedProvider && selectedProduct) {
      setLoanDetails({
        ...details,
        providerName: selectedProvider.name,
        productName: selectedProduct.name,
      });
      setStep('details');
    }
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep('calculator');
    } else if (step === 'calculator') {
      setEligibilityResult(null);
      setStep('product');
    } else if (step === 'product') {
      setSelectedProvider(null);
      setStep('provider');
    }
  };

  const handleReset = () => {
    setStep('provider');
    setSelectedProvider(null);
    setSelectedProduct(null);
    setEligibilityResult(null);
    setLoanDetails(null);
    setIsLoading(false);
  };
  
  const canGoBack = step !== 'provider';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex">
            <a className="mr-6 flex items-center space-x-2" href="/">
              <Logo className="h-6 w-6" />
              <span className="font-bold">LoanFlow Mini</span>
            </a>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            {canGoBack && <Button variant="ghost" onClick={handleBack}>Back</Button>}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="container py-8 md:py-12">
          {step === 'provider' && <ProviderSelection providers={mockProviders} onSelect={handleProviderSelect} />}
          
          {step === 'product' && selectedProvider && (
            <ProductSelection provider={selectedProvider} onSelect={handleProductSelect} />
          )}

          {step === 'calculator' && selectedProduct && (
            <LoanOfferAndCalculator
              product={selectedProduct}
              isLoading={isLoading}
              eligibilityResult={eligibilityResult}
              onAccept={handleLoanAccept}
            />
          )}

          {step === 'details' && loanDetails && (
            <LoanDetailsView details={loanDetails} onReset={handleReset} />
          )}
        </div>
      </main>
    </div>
  );
}
