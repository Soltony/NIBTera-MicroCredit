
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import type { LoanDetails, LoanProvider } from '@/lib/types';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

async function getProviders(): Promise<LoanProvider[]> {
    // Database removed, returning empty array.
    return [];
}

async function getLoanHistory(): Promise<LoanDetails[]> {
    // Database removed, returning empty array.
    return [];
}


export default async function DashboardPage() {
    const providers = await getProviders();
    const loanHistory = await getLoanHistory();
    
    return (
        <Suspense fallback={
            <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <DashboardClient providers={providers} initialLoanHistory={loanHistory} />
        </Suspense>
    );
}
