

import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { LoanProvider, LoanProduct } from '@/lib/types';
import { ApplyUploadClient } from './client';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';

async function getProviderAndProduct(providerId: string, productId: string): Promise<{ provider: LoanProvider; product: LoanProduct } | null> {
    const provider = await prisma.loanProvider.findUnique({
        where: { id: providerId },
        include: {
            products: {
                where: { id: productId, status: 'Active', productType: 'SME' },
                include: { requiredDocuments: true }
            }
        }
    });

    if (!provider || provider.products.length === 0) return null;

    const product = provider.products[0];
    
    return {
        provider: provider as LoanProvider,
        product: product as LoanProduct,
    };
}


export default async function ApplyUploadPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    const providerId = searchParams['providerId'] as string;
    const productId = searchParams['product'] as string;
    const borrowerId = searchParams['borrowerId'] as string;

    if (!providerId || !productId || !borrowerId) {
        notFound();
    }
    
    const data = await getProviderAndProduct(providerId, productId);

    if (!data) {
        return (
             <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <Logo className="h-12 w-12 text-destructive" />
                    <h2 className="text-xl font-semibold">Product Not Found</h2>
                    <p className="text-muted-foreground max-w-sm">The SME loan product you selected could not be found or is no longer available.</p>
                    <Button asChild>
                        <a href={`/loan?borrowerId=${borrowerId}`}>Go Back to Dashboard</a>
                    </Button>
                </div>
            </div>
        )
    }

    return <ApplyUploadClient provider={data.provider} product={data.product} borrowerId={borrowerId} />;
}

    