
import type { LoanDetails, LoanProvider } from '@/lib/types';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { HistoryClient } from '@/components/history/history-client';

async function getProviders(): Promise<LoanProvider[]> {
    // Database removed, returning empty array.
    return [];
}


async function getLoanHistory(): Promise<LoanDetails[]> {
    // Database removed, returning empty array.
    return [];
}


export default async function HistoryPage() {
    const loanHistory = await getLoanHistory();
    const providers = await getProviders();
    
    return (
        <Suspense fallback={
            <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <HistoryClient initialLoanHistory={loanHistory} providers={providers} />
        </Suspense>
    );
}
