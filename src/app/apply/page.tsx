
import { LoanDetailsView } from '@/components/loan/loan-details-view';
import { LoanOfferAndCalculator } from '@/components/loan/loan-offer-and-calculator';
import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useLoanHistory } from '@/hooks/use-loan-history';
import { prisma } from '@/lib/prisma';
import type { LoanDetails, LoanProvider, LoanProduct } from '@/lib/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ApplyClient } from './client';

async function getProviders(): Promise<LoanProvider[]> {
    const providers = await prisma.loanProvider.findMany({
        include: {
            products: true,
        },
        orderBy: {
            displayOrder: 'asc'
        }
    });
    return providers.map(p => ({
        ...p,
    }));
}


export default async function ApplyPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    const providers = await getProviders();
    const providerId = searchParams.providerId as string;
    
    const selectedProvider = providers.find(p => p.id === providerId);

    if (!selectedProvider) {
        return (
             <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <Logo className="h-12 w-12 text-destructive" />
                    <h2 className="text-xl font-semibold">Provider Not Found</h2>
                    <p className="text-muted-foreground max-w-sm">The loan provider you selected could not be found. It may no longer be available.</p>
                    <Button asChild>
                        <a href="/loan">Go Back to Dashboard</a>
                    </Button>
                </div>
            </div>
        )
    }

    return <ApplyClient provider={selectedProvider} />;
}
