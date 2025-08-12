
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
  const [defaultProviderId, setDefaultProviderId] = useState<string | null>(null);

  const nibBankColor = '#fdb913';
  
  useEffect(() => {
    const fetchDefaultProvider = async () => {
        try {
            const response = await fetch('/api/providers');
            if (!response.ok) throw new Error('Failed to fetch providers');
            const providers = await response.json();
            const activeProvider = providers.find(p => p.products.some(prod => prod.status === 'Active'));

            if (activeProvider) {
                setDefaultProviderId(activeProvider.id);
            } else {
                 setError("No loan providers with active products are available at this time.");
                 setIsLoading(false);
            }
        } catch(err) {
            setError("Failed to load provider information.");
            setIsLoading(false);
        }
    }
    fetchDefaultProvider();
  }, [])

  useEffect(() => {
    const performCheck = async () => {
      // Wait until we have a default provider ID
      if (!defaultProviderId) return;

      const currentProviderId = providerId || defaultProviderId;

      setIsLoading(true);
      setError(null);
      try {
        const eligibilityResult = await checkLoanEligibility({
            providerId: currentProviderId,
        });
        
        const params = new URLSearchParams();
        params.set('providerId', currentProviderId);

        if (eligibilityResult.isEligible) {
          params.set('min', String(eligibilityResult.suggestedLoanAmountMin || 0));
          params.set('max', String(eligibilityResult.suggestedLoanAmountMax || 0));
        } else {
          // Still redirect, but the dashboard will show ineligibility
          params.set('error', eligibilityResult.reason || "We're sorry, but you are not eligible for a loan at this time.");
        }
        router.push(`/loan?${params.toString()}`);

      } catch (error) {
        console.error('Eligibility check failed:', error);
        const params = new URLSearchParams();
        params.set('providerId', currentProviderId);
        params.set('error', 'An unexpected error occurred during the eligibility check.');
        router.push(`/loan?${params.toString()}`);
      } finally {
        // We don't set loading to false because we are navigating away.
      }
    };

    performCheck();
  }, [providerId, router, defaultProviderId]);


  const handleBack = () => {
    router.push('/');
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
       <header className="sticky top-0 z-40 w-full border-b" style={{ backgroundColor: nibBankColor }}>
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex items-center">
            <Logo className="h-6 w-6 mr-4" />
            <h1 className="text-lg font-semibold tracking-tight text-primary-foreground">Check Eligibility</h1>
          </div>
        </div>
      </header>
       <main className="flex-1 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin" style={{ color: nibBankColor }} />
                <h2 className="text-xl font-semibold">Checking your eligibility...</h2>
                <p className="text-muted-foreground">Please wait a moment while we check your loan eligibility.</p>
            </div>
             {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
        </div>
      </main>
    </div>
  );
}
