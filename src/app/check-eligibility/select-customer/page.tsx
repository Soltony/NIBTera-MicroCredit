
import { EligibilityCheckerClient } from '@/components/loan/eligibility-checker-client';

async function getCustomers() {
    // Database removed, returning empty array.
    return [];
}

async function getProviders() {
    // Database removed, returning empty array.
    return [];
}

export default async function SelectCustomerPage() {
    const customers = await getCustomers();
    const providers = await getProviders();
    
    return <EligibilityCheckerClient customers={customers as any[]} providers={providers as any[]} />;
}
