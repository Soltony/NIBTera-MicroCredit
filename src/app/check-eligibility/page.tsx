
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/icons';
import type { LoanProvider } from '@/lib/types';
import { checkLoanEligibility } from '@/actions/eligibility';


export default function CheckEligibilityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get('customerId');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<LoanProvider[]>([]);

  const nibBankColor = '#fdb913';
  
  useEffect(() => {
    const fetchProviders = async () => {
        try {
            const response = await fetch('/api/providers');
            if (!response.ok) throw new Error('Failed to fetch providers');
            const data = await response.json();
            setProviders(data);
        } catch(err) {
            setError("Failed to load provider information.");
            setIsLoading(false);
        }
    }
    fetchProviders();
  }, [])

  useEffect(() => {
    const performCheck = async () => {
      if (providers.length === 0 || !customerId) return;

      const nibProvider = providers.find(p => p.name === 'NIb Bank');
      if (!nibProvider) {
        setError("Default provider (NIb Bank) not found.");
        setIsLoading(false);
        return;
      }
      
      const providerId = Number(nibProvider.id);

      setIsLoading(true);
      setError(null);
      
      const { isEligible, reason, score, maxLoanAmount } = await checkLoanEligibility(Number(customerId), providerId);

      const params = new URLSearchParams();
      params.set('providerId', String(providerId));
      params.set('customerId', customerId);

      if (isEligible) {
          const productWithLowestMin = nibProvider.products
            .filter(p => p.status === 'Active')
            .reduce((prev, curr) => ((prev.minLoan ?? Infinity) < (curr.minLoan ?? Infinity) ? prev : curr), { minLoan: Infinity });
          
          const suggestedLoanAmountMin = productWithLowestMin.minLoan || 500;

          params.set('min', String(suggestedLoanAmountMin));
          params.set('max', String(maxLoanAmount));
      } else {
        params.set('error', reason);
      }
      
      router.push(`/loan?${params.toString()}`);
    };

    if(providers.length > 0 && customerId) {
        performCheck();
    }
  }, [providers, router, customerId]);


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
                <p className="text-muted-foreground">Please wait a moment while we check your loan eligibility with NIb Bank.</p>
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
