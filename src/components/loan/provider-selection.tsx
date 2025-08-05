'use client';

import type { LoanProvider } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

interface ProviderSelectionProps {
  providers: LoanProvider[];
  onSelect: (provider: LoanProvider) => void;
}

export function ProviderSelection({ providers, onSelect }: ProviderSelectionProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Choose a Loan Provider</h1>
        <p className="text-lg text-muted-foreground mt-2">Select a provider to see their available loan products.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((provider) => (
          <Card
            key={provider.id}
            onClick={() => onSelect(provider)}
            className="cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-300 group"
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <provider.icon className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>{provider.name}</CardTitle>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
