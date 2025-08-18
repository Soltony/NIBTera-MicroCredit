
import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { LoanProvider } from '@/lib/types';
import { ApplyClient } from './client';
import { getConnectedDataSource } from '@/data-source';
import type { DataSource } from 'typeorm';

// Helper function to safely parse JSON from DB
const safeJsonParse = (jsonString: string | null | undefined, defaultValue: any) => {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return defaultValue;
    }
};

async function getProvider(providerId: string): Promise<LoanProvider | null> {
    if (!providerId) return null;
    try {
        const dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository('LoanProvider');
        
        const provider = await providerRepo.findOne({
            where: { id: Number(providerId) },
            relations: ['products'],
        });

        if (!provider) return null;

        // Convert to plain object for client component
        return {
            id: String(provider.id),
            name: provider.name,
            icon: provider.icon,
            colorHex: provider.colorHex,
            displayOrder: provider.displayOrder,
            products: provider.products.map(prod => ({
                id: String(prod.id),
                name: prod.name,
                description: prod.description,
                icon: prod.icon,
                minLoan: prod.minLoan,
                maxLoan: prod.maxLoan,
                serviceFee: safeJsonParse(prod.serviceFee, { type: 'percentage', value: 0 }),
                dailyFee: safeJsonParse(prod.dailyFee, { type: 'percentage', value: 0 }),
                penaltyRules: safeJsonParse(prod.penaltyRules, []),
                status: prod.status as 'Active' | 'Disabled'
            }))
        } as any;
    } catch(e) {
        console.error(e);
        return null;
    }
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
