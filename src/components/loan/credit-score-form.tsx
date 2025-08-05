'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { CheckLoanEligibilityOutput } from '@/lib/types';

const formSchema = z.object({
  annualIncome: z.coerce.number().min(1000, { message: 'Annual income must be at least $1,000.' }),
  creditScore: z.coerce.number().min(300, { message: 'Credit score must be at least 300.' }).max(850, { message: 'Credit score cannot exceed 850.' }),
});

type CreditScoreFormValues = z.infer<typeof formSchema>;

interface CreditScoreFormProps {
  onSubmit: (data: CreditScoreFormValues) => void;
  isLoading: boolean;
  result: CheckLoanEligibilityOutput | null;
}

export function CreditScoreForm({ onSubmit, isLoading, result }: CreditScoreFormProps) {
  const form = useForm<CreditScoreFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      annualIncome: 50000,
      creditScore: 650,
    },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Check Your Loan Eligibility</CardTitle>
          <CardDescription>Enter your financial details to see what you may qualify for.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {result && !result.isEligible && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Not Eligible for Loan</AlertTitle>
                    <AlertDescription>
                      {result.reason || "We're sorry, but you are not eligible for a loan at this time."}
                    </AlertDescription>
                  </Alert>
              )}
              <FormField
                control={form.control}
                name="annualIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Annual Income (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 50000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="creditScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit Score</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 650" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check Eligibility
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}