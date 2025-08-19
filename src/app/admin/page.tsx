'use client';

import { DashboardClient } from '@/components/admin/dashboard-client';
import { getUserFromSession } from '@/lib/user';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { getConnectedDataSource } from '@/data-source';
import { MoreThanOrEqual, LessThan, FindOptionsWhere } from 'typeorm';
import { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
    try {
        const currentUser = await getUserFromSession();
        const dataSource = await getConnectedDataSource();
        
        const loanRepo = dataSource.getRepository('LoanDetails');
        const userRepo = dataSource.getRepository('User');
        const productRepo = dataSource.getRepository('LoanProduct');
        const providerRepo = dataSource.getRepository('LoanProvider');
        
        const whereClause: FindOptionsWhere<any> = {};
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

        const userWhere: FindOptionsWhere<any> = {};
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
        const productWhereClause: any = {};
        if (currentUser?.role === 'Loan Provider' && currentUser.providerId) {
             productWhereClause.providerId = Number(currentUser.providerId);
        }
        
        const products = await productRepo.find({ where: productWhereClause, relations: ['loans', 'provider']});

        const productsWithDetails = products.map(p => {
             const activeLoans = p.loans.filter(l => l.repaymentStatus === 'Unpaid').length;
             const defaultedLoans = p.loans.filter(l => l.repaymentStatus === 'Unpaid' && new Date() > new Date(l.dueDate)).length;
             return {
                name: p.name,
                provider: p.provider?.name || 'N/A',
                active: activeLoans,
                defaulted: defaultedLoans,
                total: p.loans.length,
                defaultRate: p.loans.length > 0 ? (defaultedLoans / p.loans.length) * 100 : 0
            };
        });

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
    } catch(e) {
        console.error(e);
        // Return a default/empty state to prevent the page from crashing
        return {
            totalLoans: 0,
            totalDisbursed: 0,
            totalPaid: 0,
            repaymentRate: 0,
            atRiskLoans: 0,
            totalUsers: 0,
            loanDisbursementData: [],
            loanStatusData: [],
            recentActivity: [],
            productOverview: [],
            providers: [],
        }
    }
}


export default function AdminDashboard() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getDashboardData().then(data => {
            setData(data);
            setLoading(false);
        });
    }, []);

    if (loading) {
        // You can return a loading spinner here
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return <DashboardClient initialData={data} />;
}
