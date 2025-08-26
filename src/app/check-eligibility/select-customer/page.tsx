
import { EligibilityCheckerClient } from '@/components/loan/eligibility-checker-client';
import prisma from '@/lib/prisma';
import type { LoanProvider } from '@/lib/types';


async function getCustomers() {
    const provisionedDataEntries = await prisma.provisionedData.findMany({
        orderBy: {
            createdAt: 'desc' // Get the latest entries first
        }
    });

    // Group all data by customerId
    const customerDataMap = new Map<string, any>();

    for (const entry of provisionedDataEntries) {
        const data = JSON.parse(entry.data as string);
        const customerId = data.id || entry.customerId; // Use id from data if available, fallback to customerId

        if (!customerDataMap.has(customerId)) {
            customerDataMap.set(customerId, { id: customerId });
        }

        const existingData = customerDataMap.get(customerId);
        // Merge new data, giving precedence to newer entries (already handled by sorting)
        customerDataMap.set(customerId, { ...data, ...existingData });
    }

    return Array.from(customerDataMap.values());
}


async function getProviders() {
    const providers = await prisma.loanProvider.findMany();
    return providers as LoanProvider[];
}

export default async function SelectCustomerPage() {
    const customers = await getCustomers();
    const providers = await getProviders();
    
    return <EligibilityCheckerClient customers={customers as any[]} providers={providers as any[]} />;
}

