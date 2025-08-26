
import { DashboardClient } from '@/components/admin/dashboard-client';
import prisma from '@/lib/prisma';
import type { LoanProvider } from '@/lib/types';
import { getUserFromSession } from '@/lib/user';
import { startOfToday, subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

async function getDashboardData(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { loanProvider: true }
    });

    const providerFilter = (user?.role === 'Super Admin' || user?.role === 'Admin')
        ? {}
        : { providerId: user?.loanProvider?.id };

    const loans = await prisma.loan.findMany({ 
        where: providerFilter,
        include: { provider: true, product: true }
    });
    
    const users = await prisma.user.count({
        where: (user?.role === 'Super Admin' || user?.role === 'Admin') ? {} : { loanProviderId: user?.loanProvider?.id }
    });

    const totalLoans = loans.length;
    const totalDisbursed = loans.reduce((acc, loan) => acc + loan.loanAmount, 0);
    const totalPaid = loans.reduce((acc, loan) => acc + (loan.repaidAmount || 0), 0);
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
                    ...providerFilter,
                    disbursedDate: {
                        gte: date,
                        lt: nextDate,
                    },
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
        where: (user?.role === 'Super Admin' || user?.role === 'Admin') ? {} : { providerId: user?.loanProvider?.id },
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
    
    const providers = await prisma.loanProvider.findMany();

    return {
        totalLoans,
        totalDisbursed,
        totalPaid,
        repaymentRate,
        atRiskLoans,
        totalUsers: users,
        loanDisbursementData,
        loanStatusData,
        recentActivity,
        productOverview,
        providers: providers as LoanProvider[],
    };
}


export default async function AdminDashboard() {
    const user = await getUserFromSession();
    if (!user) {
        return <div>Not authenticated</div>;
    }
    
    const data = await getDashboardData(user.id);
    return <DashboardClient initialData={data} />;
}
