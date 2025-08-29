
import { DashboardClient } from '@/components/admin/dashboard-client';
import prisma from '@/lib/prisma';
import type { LoanProvider, LedgerAccount, DashboardData } from '@/lib/types';
import { getUserFromSession } from '@/lib/user';
import { startOfToday, subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

async function getProviderData(providerId?: string): Promise<DashboardData> {
    const providerFilter = providerId ? { product: { providerId: providerId }} : {};
    const providerWhereClause = providerId ? { id: providerId } : {};

    const loans = await prisma.loan.findMany({ 
        where: providerFilter,
        include: { product: true }
    });
    
    const usersCount = providerId 
        ? await prisma.loan.groupBy({
            by: ['borrowerId'],
            where: { product: { providerId: providerId } },
          }).then(results => results.length)
        : await prisma.user.count(); 

    const providersData = await prisma.loanProvider.findMany({
        where: providerWhereClause,
        include: { ledgerAccounts: true }
    });
    
    const allLedgerAccounts = providersData.flatMap(p => p.ledgerAccounts);
    const totalInitialFund = providersData.reduce((acc, p) => acc + p.startingCapital, 0);
    const providerFund = providersData.reduce((acc, p) => acc + p.initialBalance, 0);

    const aggregateLedger = (type: string, category?: string) => {
        return allLedgerAccounts
            .filter(acc => acc.type === type && (category ? acc.category === category : true))
            .reduce((sum, acc) => sum + acc.balance, 0);
    };
    
    const receivables = {
        principal: aggregateLedger('Receivable', 'Principal'),
        interest: aggregateLedger('Receivable', 'Interest'),
        serviceFee: aggregateLedger('Receivable', 'ServiceFee'),
        penalty: aggregateLedger('Receivable', 'Penalty'),
    };
    
    const collections = {
        principal: aggregateLedger('Received', 'Principal'),
        interest: aggregateLedger('Received', 'Interest'),
        serviceFee: aggregateLedger('Received', 'ServiceFee'),
        penalty: aggregateLedger('Received', 'Penalty'),
    };

    const income = {
        interest: aggregateLedger('Income', 'Interest'),
        serviceFee: aggregateLedger('Income', 'ServiceFee'),
        penalty: aggregateLedger('Income', 'Penalty'),
    };
    
    const totalDisbursed = loans.reduce((acc, loan) => acc + loan.loanAmount, 0);
    const totalLoans = loans.length;
    const paidLoans = loans.filter(l => l.repaymentStatus === 'Paid').length;
    const repaymentRate = totalLoans > 0 ? (paidLoans / totalLoans) * 100 : 0;
    const atRiskLoans = loans.filter(l => l.repaymentStatus === 'Unpaid' && new Date(l.dueDate) < new Date()).length;

    const today = startOfToday();
    const loanDisbursementData = await Promise.all(
        Array.from({ length: 7 }).map(async (_, i) => {
            const date = subDays(today, 6 - i);
            const nextDate = subDays(today, 5 - i);
            const amount = await prisma.loan.aggregate({
                _sum: { loanAmount: true },
                where: {
                    disbursedDate: {
                        gte: date,
                        lt: nextDate,
                    },
                    ...(providerFilter && { product: providerFilter.product })
                },
            });
            return {
                name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                amount: amount._sum.loanAmount || 0,
            };
        })
    );

    const paidCount = loans.filter(l => l.repaymentStatus === 'Paid').length;
    const unpaidCount = loans.filter(l => l.repaymentStatus === 'Unpaid' && new Date(l.dueDate) >= new Date()).length;
    const overdueCount = atRiskLoans;
    const loanStatusData = [
        { name: 'Paid', value: paidCount },
        { name: 'Active (Unpaid)', value: unpaidCount },
        { name: 'Overdue', value: overdueCount },
    ];

    const recentActivity = await prisma.loan.findMany({
        where: providerFilter,
        take: 5,
        orderBy: { disbursedDate: 'desc' },
        include: { product: true }
    }).then(loans => loans.map(l => ({
        id: l.id,
        customer: `Borrower #${l.borrowerId}`,
        product: l.product.name,
        status: l.repaymentStatus,
        amount: l.loanAmount,
    })));

    const allProducts = await prisma.loanProduct.findMany({
        where: providerId ? { providerId: providerId } : {},
        include: { provider: true, _count: { select: { loans: true } } }
    });

    const productOverview = await Promise.all(allProducts.map(async p => {
        const active = await prisma.loan.count({ where: { productId: p.id, repaymentStatus: 'Unpaid' } });
        const defaulted = await prisma.loan.count({ where: { productId: p.id, repaymentStatus: 'Unpaid', dueDate: { lt: new Date() } } });
        return {
            name: p.name,
            provider: p.provider.name,
            active,
            defaulted,
            total: p._count.loans,
            defaultRate: p._count.loans > 0 ? (defaulted / p._count.loans) * 100 : 0
        };
    }));

    return {
        totalLoans,
        totalDisbursed,
        repaymentRate,
        atRiskLoans,
        totalUsers: usersCount,
        loanDisbursementData,
        loanStatusData,
        recentActivity,
        productOverview,
        initialFund: totalInitialFund,
        providerFund,
        receivables,
        collections,
        income,
    };
}

export async function getDashboardData(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { loanProvider: true }
    });

    const isSuperAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
    const providers = await prisma.loanProvider.findMany();
    
    if (!isSuperAdmin) {
        return {
            providers: providers as LoanProvider[],
            providerData: [await getProviderData(user?.loanProvider?.id)],
        }
    }

    // For Super Admin, fetch all data
    const overallData = await getProviderData();
    const providerSpecificData = await Promise.all(providers.map(p => getProviderData(p.id)));

    return {
        providers: providers as LoanProvider[],
        providerData: [overallData, ...providerSpecificData],
    };
}


export default async function AdminDashboard() {
    const user = await getUserFromSession();
    if (!user) {
        return <div>Not authenticated</div>;
    }
    
    const data = await getDashboardData(user.id);
    if (!data) {
        return <div>Loading dashboard...</div>;
    }
    
    return <DashboardClient dashboardData={data} />;
}
