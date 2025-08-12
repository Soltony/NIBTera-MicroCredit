
import { DashboardClient } from '@/components/admin/dashboard-client';
import { prisma } from '@/lib/prisma';
import { getUserFromSession } from '@/lib/session';
import { subDays, startOfDay, endOfDay } from 'date-fns';

async function getDashboardData() {
    const currentUser = await getUserFromSession();
    
    const whereClause: any = {};
    if (currentUser?.role === 'Loan Provider' && currentUser.providerId) {
        whereClause.providerId = currentUser.providerId;
    }

    const allLoans = await prisma.loanDetails.findMany({
        where: whereClause,
        include: {
            payments: true,
            provider: true,
            product: true,
        },
        orderBy: {
            disbursedDate: 'desc',
        },
    });

    const totalLoans = allLoans.length;
    const totalDisbursed = allLoans.reduce((acc, loan) => acc + loan.loanAmount, 0);

    const paidLoans = allLoans.filter(loan => loan.repaymentStatus === 'Paid');
    const totalPaid = paidLoans.reduce((acc, loan) => acc + (loan.repaidAmount || 0), 0);

    const repaidOnTime = paidLoans.filter(loan => {
        const lastPayment = loan.payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        if (!lastPayment) return false;
        return new Date(lastPayment.date) <= new Date(loan.dueDate);
    }).length;
    
    const repaymentRate = paidLoans.length > 0 ? (repaidOnTime / paidLoans.length) * 100 : 0;

    const atRiskLoans = allLoans.filter(
        (loan) => loan.repaymentStatus === 'Unpaid' && new Date() > new Date(loan.dueDate)
    ).length;

    const users = await prisma.user.findMany({ where: whereClause.providerId ? { providerId: whereClause.providerId } : {} });
    const totalUsers = users.length;
    
    // Loan Disbursement Chart Data
    const loanDisbursementData: { name: string; amount: number }[] = [];
    const dateRange = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();

    for (const date of dateRange) {
        const start = startOfDay(date);
        const end = endOfDay(date);
        const dailyLoans = await prisma.loanDetails.findMany({
            where: {
                ...whereClause,
                disbursedDate: {
                    gte: start,
                    lt: end,
                }
            }
        });
        const dailyTotal = dailyLoans.reduce((sum, loan) => sum + loan.loanAmount, 0);
        loanDisbursementData.push({
            name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            amount: dailyTotal,
        });
    }

    // Loan Status Distribution Chart Data
    const overdueCount = atRiskLoans;
    const activeUnpaidCount = allLoans.filter(loan => loan.repaymentStatus === 'Unpaid' && new Date() <= new Date(loan.dueDate)).length;
    const paidCount = paidLoans.length;
    const loanStatusData = [
      { name: 'Paid', value: paidCount },
      { name: 'Active (Unpaid)', value: activeUnpaidCount },
      { name: 'Overdue', value: overdueCount },
    ];

    // Loan Products Overview
    const productOverview = await prisma.loanProduct.groupBy({
        by: ['name', 'providerId'],
        _count: { id: true },
        where: whereClause.providerId ? { providerId: whereClause.providerId } : {},
    });

    const productsWithDetails = await Promise.all(productOverview.map(async (p) => {
        const provider = await prisma.loanProvider.findUnique({ where: { id: p.providerId } });
        const activeLoans = await prisma.loanDetails.count({
            where: {
                ...whereClause,
                product: { name: p.name },
                repaymentStatus: 'Unpaid',
            }
        });
        const defaultedLoans = await prisma.loanDetails.count({
            where: {
                ...whereClause,
                product: { name: p.name },
                repaymentStatus: 'Unpaid',
                dueDate: { lt: new Date() }
            }
        });
        return {
            name: p.name,
            provider: provider?.name || 'N/A',
            active: activeLoans,
            defaulted: defaultedLoans,
            total: p._count.id,
            defaultRate: p._count.id > 0 ? (defaultedLoans / p._count.id) * 100 : 0
        };
    }));


    return {
        totalLoans,
        totalDisbursed,
        totalPaid,
        repaymentRate,
        atRiskLoans,
        totalUsers,
        loanDisbursementData,
        loanStatusData,
        recentActivity: allLoans.slice(0, 5).map(loan => ({
            id: loan.id,
            customer: loan.provider.name,
            product: loan.product.name,
            status: loan.repaymentStatus,
            amount: loan.loanAmount
        })),
        productOverview: productsWithDetails,
    };
}


export default async function AdminDashboard() {
    const data = await getDashboardData();

    return <DashboardClient initialData={data} />;
}
