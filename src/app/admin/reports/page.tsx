
import { ReportsClient } from '@/components/admin/reports-client';
import type { LoanProvider as LoanProviderType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export interface ReportLoan {
    id: string;
    loanAmount: number;
    serviceFee: number;
    interestRate: number;
    disbursedDate: Date;
    dueDate: Date;
    penaltyAmount: number;
    repaymentStatus: string;
    repaidAmount: number | null;
    providerName: string;
    productName: string;
    paymentsCount: number;
}

async function getLoanReportData(): Promise<{ loans: ReportLoan[], providers: LoanProviderType[] }> {
    // Database removed, returning empty arrays.
    return { loans: [], providers: [] };
}


export default async function AdminReportsPage() {
    const { loans, providers } = await getLoanReportData();
    return <ReportsClient initialLoans={loans} providers={providers} />;
}
