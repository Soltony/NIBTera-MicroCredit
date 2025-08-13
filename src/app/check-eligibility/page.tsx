
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/icons';
import type { LoanProvider } from '@/lib/types';
import { AppDataSource } from '@/data-source';
import { Customer as CustomerEntity } from '@/entities/Customer';


async function checkLoanEligibility(customerId: number): Promise<{isEligible: boolean; reason: string; score: number}> {
  if (!AppDataSource.isInitialized) await AppDataSource.initialize();
  const customerRepo = AppDataSource.getRepository(CustomerEntity);

  const customer = await customerRepo.findOneBy({ id: customerId });
  
  if (!customer) {
    return { isEligible: false, reason: 'Customer profile not found.', score: 0 };
  }

  let score = 0;
  // Basic scoring logic
  if (customer.age >= 25 && customer.age <= 55) score += 20;
  if (customer.monthlySalary > 4000) score += 30;
  
  try {
      const loanHistory = JSON.parse(customer.loanHistory);
      if (loanHistory.onTimeRepayments > 3) score += 25;
      if (loanHistory.totalLoans > 0 && loanHistory.onTimeRepayments / loanHistory.totalLoans > 0.8) score += 10;
  } catch (e) {
      console.error("Could not parse loan history", e);
  }


  if (score >= 50) {
    return { isEligible: true, reason: 'Congratulations! You are eligible for a loan.', score };
  } else {
    return { isEligible: false, reason: 'Based on your profile, you are not currently eligible for a loan.', score };
  }
}


export default function CheckEligibilityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get('customerId');
  const providerIdFromUrl = searchParams.get('providerId');

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

      const providerId = providerIdFromUrl || providers.find(p => p.products.some(prod => prod.status === 'Active'))?.id;

      if (!providerId) {
        setError("No loan providers with active products are available at this time.");
        setIsLoading(false);
        return;
      }
      
      const provider = providers.find(p => p.id === providerId);
      if (!provider) {
        setError("Selected provider not found.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      const { isEligible, reason, score } = await checkLoanEligibility(Number(customerId));

      const params = new URLSearchParams();
      params.set('providerId', providerId);

      if (isEligible) {
        const activeProducts = provider.products.filter(p => p.status === 'Active');
        if (activeProducts.length > 0) {
          const scoreMultiplier = Math.min(1.5, 1 + (score - 50) / 100);
          const highestMaxLoan = activeProducts.reduce((max, p) => Math.max(max, p.maxLoan || 0), 0);
          const suggestedLoanAmountMax = Math.round((highestMaxLoan * scoreMultiplier) / 100) * 100;
          const suggestedLoanAmountMin = activeProducts.reduce((min, p) => Math.min(min, p.minLoan || 500), Infinity);
          
          params.set('min', String(suggestedLoanAmountMin || 0));
          params.set('max', String(suggestedLoanAmountMax || 0));
        } else {
           params.set('error', `This provider (${provider.name}) has no active loan products available.`);
        }
      } else {
        params.set('error', reason);
      }
      
      router.push(`/loan?${params.toString()}`);
    };

    if(providers.length > 0 && customerId) {
        performCheck();
    }
  }, [providers, providerIdFromUrl, router, customerId]);


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

