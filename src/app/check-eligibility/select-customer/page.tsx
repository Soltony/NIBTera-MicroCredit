
import { EligibilityCheckerClient } from '@/components/loan/eligibility-checker-client';
import { getConnectedDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import type { Customer } from '@/entities/Customer';

async function getCustomers() {
    try {
        const dataSource = await getConnectedDataSource();
        const customerRepo = dataSource.getRepository('Customer');
        const customers = await customerRepo.find();
        
        // Map to plain objects
        return customers.map(c => ({
            id: String(c.ID),
            age: c.AGE,
            monthlyIncome: c.MONTHLY_INCOME,
            gender: c.GENDER,
            educationLevel: c.EDUCATION_LEVEL,
            loanHistory: JSON.parse(c.LOAN_HISTORY),
            phone_number: c.PHONE_NUMBER,
            national_id: c.NATIONAL_ID,
        }));
    } catch(e) {
        console.error(e);
        return [];
    }
}

async function getProviders() {
    try {
        const dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository(LoanProvider);
        const providers = await providerRepo.find({
            relations: ['products'],
            order: {
                displayOrder: 'ASC'
            }
        });
        
        // Map the icon string to a name that can be looked up on the client
        return providers.map(p => ({
            ...p,
            id: String(p.id),
            products: p.products.map(prod => ({
                ...prod,
                id: String(prod.id),
            }))
        }));
    } catch(e) {
        console.error(e);
        return [];
    }
}

export default async function SelectCustomerPage() {
    const customers = await getCustomers();
    const providers = await getProviders();
    
    return <EligibilityCheckerClient customers={customers as any[]} providers={providers as any[]} />;
}
