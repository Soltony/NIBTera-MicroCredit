
import { EligibilityCheckerClient } from '@/components/loan/eligibility-checker-client';
import prisma from '@/lib/prisma';
import type { LoanProvider } from '@/lib/types';


async function getCustomers() {
    const customers = await prisma.customer.findMany({
        include: {
            provisionedData: true,
        },
    });

    return customers.map(c => {
        const provisionedDataObject: Record<string, any> = {};
        c.provisionedData.forEach(pd => {
            Object.assign(provisionedDataObject, JSON.parse(pd.data as string));
        });

        return {
            ...c,
            loanHistory: JSON.parse(c.loanHistory as string),
            // Combine base customer data with all provisioned data for the UI
            allData: {
                id: c.id,
                age: c.age,
                gender: c.gender,
                educationLevel: c.educationLevel,
                monthlyIncome: c.monthlyIncome,
                ...provisionedDataObject,
            }
        };
    });
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

