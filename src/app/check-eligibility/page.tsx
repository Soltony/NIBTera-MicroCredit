
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CheckLoanEligibilityOutput } from '@/lib/types';
import { checkLoanEligibility } from '@/ai/flows/loan-eligibility-check';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/icons';

export default function CheckEligibilityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerId = searchParams.get('providerId');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CheckLoanEligibilityOutput | null>(null);

  const handleCheckEligibility = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      // In a real app, you'd collect user input here.
      // For this mock, we use hardcoded values.
      const eligibilityResult = await checkLoanEligibility({
        creditScore: 700,
        annualIncome: 60000,
      });
      setResult(eligibilityResult);
      if (eligibilityResult.isEligible && providerId) {
        const params = new URLSearchParams();
        params.set('providerId', providerId);
        params.set('min', String(eligibilityResult.suggestedLoanAmountMin || 0));
        params.set('max', String(eligibilityResult.suggestedLoanAmountMax || 0));

        setTimeout(() => router.push(`/dashboard?${params.toString()}`), 2000);
      }
    } catch (error) {
      console.error('Eligibility check failed:', error);
      setResult({ isEligible: false, reason: 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/');
  }

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
             <Button variant="ghost" onClick={handleBack}>Back</Button>
          </div>
        </div>
      </header>
       <main className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl mx-auto">
            <Card className="shadow-lg">
                <CardHeader>
                <CardTitle>Check Your Loan Eligibility</CardTitle>
                <CardDescription>Click the button below to see what you may qualify for.</CardDescription>
                </CardHeader>
                <CardContent>
                {result && !result.isEligible && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Not Eligible for Loan</AlertTitle>
                        <AlertDescription>
                        {result.reason || "We're sorry, but you are not eligible for a loan at this time."}
                        </AlertDescription>
                    </Alert>
                )}
                 {result && result.isEligible && (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Congratulations! You're eligible.</AlertTitle>
                        <AlertDescription>
                            Redirecting you to the dashboard...
                        </AlertDescription>
                    </Alert>
                )}
                </CardContent>
                <CardFooter>
                <Button onClick={handleCheckEligibility} className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Check Eligibility
                </Button>
                </CardFooter>
            </Card>
        </div>
      </main>
    </div>
  );
}
