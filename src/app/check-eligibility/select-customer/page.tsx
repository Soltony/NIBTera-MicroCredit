
import { EligibilityCheckerClient } from '@/components/loan/eligibility-checker-client';
import prisma from '@/lib/prisma';
import type { LoanProvider } from '@/lib/types';


async function getBorrowers() {
    const provisionedDataEntries = await prisma.provisionedData.findMany({
        orderBy: {
            createdAt: 'desc' // Get the latest entries first
        }
    });

    // Group all data by borrowerId
    const borrowerDataMap = new Map<string, any>();

    for (const entry of provisionedDataEntries) {
        const data = JSON.parse(entry.data as string);
        const borrowerId = data.id || entry.borrowerId; // Use id from data if available, fallback to borrowerId

        if (!borrowerDataMap.has(borrowerId)) {
            borrowerDataMap.set(borrowerId, { id: borrowerId });
        }

        const existingData = borrowerDataMap.get(borrowerId);
        // Merge new data, giving precedence to newer entries (already handled by sorting)
        borrowerDataMap.set(borrowerId, { ...data, ...existingData });
    }

    return Array.from(borrowerDataMap.values());
}


async function getProviders() {
    const providers = await prisma.loanProvider.findMany();
    return providers as LoanProvider[];
}

export default async function SelectCustomerPage() {
    const borrowers = await getBorrowers();
    const providers = await getProviders();
    
    return <EligibilityCheckerClient borrowers={borrowers as any[]} providers={providers as any[]} />;
}
