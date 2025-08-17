
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { getConnectedDataSource } from '@/data-source';
import type { LoanDetails, LoanProvider, FeeRule, PenaltyRule } from '@/lib/types';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

async function getProviders(): Promise<LoanProvider[]> {
    try {
        const dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository('LoanProvider');
        const providers = await providerRepo.find({
            relations: ['products'],
            order: {
                displayOrder: 'ASC',
                products: {
                    name: 'ASC'
                }
            }
        });

        // Manually map to plain objects to avoid passing class instances to client components.
        return providers.map(p => ({
            id: String(p.id),
            name: p.name,
            icon: p.icon,
            colorHex: p.colorHex,
            displayOrder: p.displayOrder,
            products: p.products.map(prod => ({
                id: String(prod.id),
                name: prod.name,
                description: prod.description,
                icon: prod.icon,
                minLoan: prod.minLoan,
                maxLoan: prod.maxLoan,
                serviceFee: JSON.parse(prod.serviceFee),
                dailyFee: JSON.parse(prod.dailyFee),
                penaltyRules: JSON.parse(prod.penaltyRules),
                status: prod.status as 'Active' | 'Disabled',
            }))
        })) as LoanProvider[];
    } catch(e) {
        console.error(e);
        return [];
    }
}

async function getLoanHistory(): Promise<LoanDetails[]> {
    try {
        const dataSource = await getConnectedDataSource();
        const loanRepo = dataSource.getRepository('LoanDetails');
        const loans = await loanRepo.find({
            relations: ['provider', 'product', 'payments'],
            order: {
                disbursedDate: 'DESC',
                payments: {
                    date: 'ASC'
                }
            },
        });

        // Manually map to plain objects to avoid passing class instances to client components.
        return loans.map(loan => ({
            id: String(loan.id),
            providerName: loan.provider.name,
            productName: loan.product.name,
            loanAmount: loan.loanAmount,
            serviceFee: loan.serviceFee,
            disbursedDate: loan.disbursedDate,
            dueDate: loan.dueDate,
            repaymentStatus: loan.repaymentStatus as 'Paid' | 'Unpaid',
            repaidAmount: loan.repaidAmount || 0,
            penaltyAmount: loan.penaltyAmount,
            product: {
              ...loan.product,
              id: String(loan.product.id),
              serviceFee: JSON.parse(loan.product.serviceFee),
              dailyFee: JSON.parse(loan.product.dailyFee),
              penaltyRules: JSON.parse(loan.product.penaltyRules),
            },
            payments: loan.payments.map(p => ({
                id: String(p.id),
                amount: p.amount,
                date: p.date,
                outstandingBalanceBeforePayment: p.outstandingBalanceBeforePayment,
            }))
        })) as LoanDetails[];
    } catch(e) {
        console.error(e);
        return [];
    }
}


export default async function DashboardPage() {
    const providers = await getProviders();
    const loanHistory = await getLoanHistory();
    
    return (
        <Suspense fallback={
            <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <DashboardClient providers={providers} initialLoanHistory={loanHistory} />
        </Suspense>
    );
}
