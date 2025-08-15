
import { EligibilityCheckerClient } from '@/components/loan/eligibility-checker-client';
import { AppDataSource } from '@/data-source';
import { Customer } from '@/entities/Customer';
import type { DataSource } from 'typeorm';

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

async function getCustomers() {
    try {
        const dataSource = await getConnectedDataSource();
        const customerRepo = dataSource.getRepository(Customer);
        const customers = await customerRepo.find();
        
        // Map to plain objects
        return customers.map(c => ({
            id: String(c.id),
            age: c.age,
            monthlyIncome: c.monthlyIncome,
            gender: c.gender,
            educationLevel: c.educationLevel,
            loanHistory: JSON.parse(c.loanHistory),
            transactionHistory: JSON.parse(c.transactionHistory),
        }));
    } catch(e) {
        console.error(e);
        return [];
    }
}

export default async function SelectCustomerPage() {
    const customers = await getCustomers();
    
    return <EligibilityCheckerClient customers={customers as any[]} />;
}
