
import { EligibilityCheckerClient } from '@/components/loan/eligibility-checker-client';
import prisma from '@/lib/prisma';
import type { LoanProvider } from '@/lib/types';


async function getCustomers() {
    const customers = await prisma.customer.findMany();
    return customers.map(c => ({
        ...c,
        loanHistory: JSON.parse(c.loanHistory as string),
    }))
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
