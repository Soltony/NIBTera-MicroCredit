'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditScoreForm } from '@/components/loan/credit-score-form';
import type { CheckLoanEligibilityOutput } from '@/lib/types';
import { checkLoanEligibility as checkEligibility } from '@/ai/flows/loan-eligibility-check';
import { Logo } from '@/components/icons';

export default function WelcomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<CheckLoanEligibilityOutput | null>(null);

  const handleCheckEligibility = async () => {
    setIsLoading(true);
    try {
      // Using mock data since the form fields are removed
      const result = await checkEligibility({ annualIncome: 50000, creditScore: 650 });
      setEligibilityResult(result);
      if (result.isEligible) {
        // Pass the results to the dashboard page via query params
        const query = new URLSearchParams({
            min: result.suggestedLoanAmountMin?.toString() || '0',
            max: result.suggestedLoanAmountMax?.toString() || '0'
        }).toString();
        router.push(`/dashboard?${query}`);
      }
    } catch (error) {
      console.error('Eligibility Check Failed:', error);
      setEligibilityResult({ isEligible: false, reason: 'An error occurred while checking eligibility.' });
    } finally {
      setIsLoading(false);
    }
  };

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
        </div>
      </header>
      <main className="flex-1 flex items-center">
        <div className="container py-8 md:py-12">
            <CreditScoreForm onCheck={handleCheckEligibility} isLoading={isLoading} result={eligibilityResult} />
        </div>
      </main>
    </div>
  );
}
