
'use client';

import type { LoanProvider } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

interface ProviderSelectionProps {
  providers: LoanProvider[];
  onSelect: (provider: LoanProvider) => void;
}

export function ProviderSelection({ providers, onSelect }: ProviderSelectionProps) {
  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Choose a Loan Provider</h1>
        <p className="text-lg text-muted-foreground mt-2">Select a provider to see their available loan products.</p>
      </div>
      <div className="space-y-4">
        {providers.map((provider) => (
          <Card
            key={provider.id}
            onClick={() => onSelect(provider)}
            className="cursor-pointer bg-card text-card-foreground hover:shadow-lg transition-all duration-300 group rounded-xl border-0"
          >
            <CardHeader className="flex flex-row items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <provider.icon className="h-8 w-8 text-primary-foreground" />
                <div>
                  <CardTitle className="text-lg font-semibold text-primary-foreground">{provider.name}</CardTitle>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-primary-foreground transition-colors" />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
