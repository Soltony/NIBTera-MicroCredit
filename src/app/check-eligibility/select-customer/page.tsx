
import { EligibilityCheckerClient } from '@/components/loan/eligibility-checker-client';
import { AppDataSource } from '@/data-source';
import { Customer } from '@/entities/Customer';

async function getCustomers() {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const customerRepo = AppDataSource.getRepository(Customer);
    const customers = await customerRepo.find();
    
    // Map to plain objects
    return customers.map(c => ({
        id: String(c.id),
        age: c.age,
        monthlySalary: c.monthlySalary,
        gender: c.gender,
        educationLevel: c.educationLevel,
        loanHistory: JSON.parse(c.loanHistory),
        transactionHistory: JSON.parse(c.transactionHistory),
    }));
}

export default async function SelectCustomerPage() {
    const customers = await getCustomers();
    
    return <EligibilityCheckerClient customers={customers as any[]} />;
}
