import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { prisma } from '@/lib/prisma';
import type { LoanDetails } from '@/lib/types';
import { getCurrentUser } from '@/lib/session';

async function getProviders() {
    const providers = await prisma.loanProvider.findMany({
        include: {
            products: true,
        }
    });

    // We need to provide the icon component itself, not just the name.
    // This is a temporary solution until the icon mapping is more robust.
    return providers.map(p => ({
        ...p,
        // The 'icon' field in the DB stores a string name, which we can't use directly
        // We'll replace it with a placeholder or a mapped component if needed. For now, this is okay.
    }));
}


export default async function DashboardPage() {
    const providers = await getProviders();
    
    // The rest of the data like loan history and eligibility is handled client-side
    // for now, so we just need to pass the providers.
    return <DashboardClient providers={providers} />;
}
