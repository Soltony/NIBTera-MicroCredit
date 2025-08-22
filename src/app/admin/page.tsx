
import { DashboardClient } from '@/components/admin/dashboard-client';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
    // Database removed, returning default/empty state
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


export default async function AdminDashboard() {
    const data = await getDashboardData();

    return <DashboardClient initialData={data} />;
}
