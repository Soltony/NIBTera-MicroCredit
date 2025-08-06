
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CheckLoanEligibilityOutput } from '@/lib/types';
import { checkLoanEligibility } from '@/ai/flows/loan-eligibility-check';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/icons';

export default function CheckEligibilityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerId = searchParams.get('providerId');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const performCheck = async () => {
      if (!providerId) {
        router.push('/');
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        // In a real app, you'd collect user input here.
        // For this mock, we use hardcoded values.
        const eligibilityResult = await checkLoanEligibility({
          creditScore: 700,
          annualIncome: 60000,
        });
        
        if (eligibilityResult.isEligible) {
          const params = new URLSearchParams();
          params.set('providerId', providerId);
          params.set('min', String(eligibilityResult.suggestedLoanAmountMin || 0));
          params.set('max', String(eligibilityResult.suggestedLoanAmountMax || 0));
          router.push(`/dashboard?${params.toString()}`);
        } else {
          setError(eligibilityResult.reason || "We're sorry, but you are not eligible for a loan at this time.");
        }
      } catch (error) {
        console.error('Eligibility check failed:', error);
        setError('An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    performCheck();
  }, [providerId, router]);


  const handleBack = () => {
    router.push('/');
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
       <header className="sticky top-0 z-40 w-full border-b bg-yellow-400/20 backdrop-blur supports-[backdrop-filter]:bg-yellow-400/20">
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
       <main className="flex-1 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
            {isLoading && (
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h2 className="text-xl font-semibold">Checking your eligibility...</h2>
                    <p className="text-muted-foreground">Please wait a moment.</p>
                </div>
            )}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Eligibility Check Failed</AlertTitle>
                    <AlertDescription>
                        {error}
                        <Button variant="link" onClick={handleBack} className="p-0 h-auto mt-2 block">
                            Return to Home
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
        </div>
      </main>
    </div>
  );
}
