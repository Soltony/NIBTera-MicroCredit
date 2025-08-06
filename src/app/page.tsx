
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LoanProvider } from '@/lib/types';
import { Building2, Landmark, Briefcase, Home, PersonStanding } from 'lucide-react';
import { Logo } from '@/components/icons';
import { ProviderSelection } from '@/components/loan/provider-selection';

const mockProviders: LoanProvider[] = [
  {
    id: 'provider-1',
    name: 'Capital Bank',
    icon: Building2,
    products: [
      { id: 'prod-1a', name: 'Personal Loan', description: 'Flexible personal loans for your needs.', icon: PersonStanding, minLoan: 400, maxLoan: 2000 },
      { id: 'prod-1b', name: 'Home Improvement Loan', description: 'Finance your home renovation projects.', icon: Home, minLoan: 10000, maxLoan: 50000 },
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
      { id: 'prod-3b', name: 'Gadget Financing', description: 'Upgrade your devices with easy financing.', icon: Home },
    ],
  },
];

export default function WelcomePage() {
  const router = useRouter();
  
  const handleProviderSelect = (provider: LoanProvider) => {
    router.push(`/check-eligibility?providerId=${provider.id}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b" style={{ backgroundColor: '#fdb913' }}>
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex items-center">
            <Logo className="h-6 w-6 mr-4" />
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-primary-foreground">Welcome</h1>
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center">
        <div className="container py-8 md:py-12">
            <ProviderSelection providers={mockProviders} onSelect={handleProviderSelect} />
        </div>
      </main>
    </div>
  );
}
