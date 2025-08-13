
import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { LoanProvider } from '@/lib/types';
import { ApplyClient } from './client';
import { AppDataSource } from '@/data-source';
import { LoanProvider as LoanProviderEntity } from '@/entities/LoanProvider';

async function getProvider(providerId: string): Promise<LoanProvider | null> {
    if (!providerId) return null;
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const providerRepo = AppDataSource.getRepository(LoanProviderEntity);
    
    const provider = await providerRepo.findOne({
        where: { id: Number(providerId) },
        relations: ['products'],
    });

    if (!provider) return null;

    // Convert to plain object for client component
    return {
        ...provider,
        id: String(provider.id),
        products: provider.products.map(prod => ({
            ...prod,
            id: String(prod.id),
            status: prod.status as 'Active' | 'Disabled'
        }))
    } as any;
}


export default async function ApplyPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    const providerId = searchParams.providerId as string;
    const selectedProvider = await getProvider(providerId);

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
