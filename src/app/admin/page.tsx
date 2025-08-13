
import { DashboardClient } from '@/components/admin/dashboard-client';
import { getUserFromSession } from '@/lib/user';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { AppDataSource } from '@/data-source';
import { LoanDetails } from '@/entities/LoanDetails';
import { User } from '@/entities/User';
import { LoanProduct } from '@/entities/LoanProduct';
import { LoanProvider } from '@/entities/LoanProvider';
import { MoreThanOrEqual, LessThan, LessThanOrEqual, MoreThan, FindOptionsWhere, In } from 'typeorm';

async function getDashboardData() {
    const currentUser = await getUserFromSession();
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    const loanRepo = AppDataSource.getRepository(LoanDetails);
    const userRepo = AppDataSource.getRepository(User);
    const productRepo = AppDataSource.getRepository(LoanProduct);
    const providerRepo = AppDataSource.getRepository(LoanProvider);
    
    const whereClause: FindOptionsWhere<LoanDetails> | FindOptionsWhere<LoanDetails>[] = {};
    if (currentUser?.role === 'Loan Provider' && currentUser.providerId) {
        whereClause.providerId = Number(currentUser.providerId);
    }

    const allLoans = await loanRepo.find({
        where: whereClause,
        relations: ['payments', 'provider', 'product'],
        order: {
            disbursedDate: 'DESC',
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

    const userWhere: FindOptionsWhere<User> = {};
    if (whereClause.providerId) {
        userWhere.providerId = whereClause.providerId;
    }
    const users = await userRepo.find({ where: userWhere });
    const totalUsers = users.length;
    
    // Loan Disbursement Chart Data
    const loanDisbursementData: { name: string; amount: number }[] = [];
    const dateRange = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();

    for (const date of dateRange) {
        const start = startOfDay(date);
        const end = endOfDay(date);
        const dailyLoans = await loanRepo.find({
            where: {
                ...whereClause,
                disbursedDate: MoreThanOrEqual(start) && LessThan(end),
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
    const productStats = await productRepo.createQueryBuilder("product")
        .leftJoin("product.loans", "loan")
        .select("product.name", "name")
        .addSelect("product.providerId", "providerId")
        .addSelect("COUNT(loan.id)", "total")
        .groupBy("product.name")
        .addGroupBy("product.providerId")
        .where(whereClause.providerId ? `product.providerId = ${whereClause.providerId}`: '1=1')
        .getRawMany();


    const productsWithDetails = await Promise.all(productStats.map(async (p) => {
        const provider = await providerRepo.findOne({ where: { id: p.providerId } });
        const activeLoans = await loanRepo.count({
            where: {
                providerId: whereClause.providerId,
                product: { name: p.name },
                repaymentStatus: 'Unpaid',
            }
        });
        const defaultedLoans = await loanRepo.count({
            where: {
                providerId: whereClause.providerId,
                product: { name: p.name },
                repaymentStatus: 'Unpaid',
                dueDate: LessThan(new Date())
            }
        });
        return {
            name: p.name,
            provider: provider?.name || 'N/A',
            active: activeLoans,
            defaulted: defaultedLoans,
            total: p.total,
            defaultRate: p.total > 0 ? (defaultedLoans / p.total) * 100 : 0
        };
    }));

    const providers = await providerRepo.find();

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
            id: String(loan.id),
            customer: loan.provider.name,
            product: loan.product.name,
            status: loan.repaymentStatus,
            amount: loan.loanAmount
        })),
        productOverview: productsWithDetails,
        providers: providers.map(p => ({...p, id: String(p.id)})),
    };
}


export default async function AdminDashboard() {
    const data = await getDashboardData();

    return <DashboardClient initialData={data as any} />;
}
