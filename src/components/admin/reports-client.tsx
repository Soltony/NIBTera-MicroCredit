
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import type { LoanProvider, ProviderReportData } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0.00 ETB';
    return new Intl.NumberFormat('en-US', { style: 'decimal' }).format(amount) + ' ETB';
};

const ReportCard = ({ title, description, children }: { title: string, description: string, children: React.ReactNode }) => (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
    </Card>
);

const ReportRow = ({ label, value }: { label: string, value: string | number }) => (
    <div className="flex justify-between items-center py-2 border-b last:border-b-0">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value}</span>
    </div>
);


const LoadingSkeleton = () => (
    <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardHeader><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-3/4 mt-2" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-3/4 mt-2" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
        </div>
        <Card><CardHeader><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-3/4 mt-2" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardHeader><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-3/4 mt-2" /></CardHeader><CardContent><Skeleton className="h-16 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-3/4 mt-2" /></CardHeader><CardContent><Skeleton className="h-16 w-full" /></CardContent></Card>
        </div>
    </div>
);


export function ReportsClient({ providers }: { providers: LoanProvider[] }) {
    const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>(providers[0]?.id);
    const [timeframe, setTimeframe] = useState('daily');
    const [reportData, setReportData] = useState<ProviderReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchReportData = useCallback(async (providerId: string, frame: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/reports/provider-summary?providerId=${providerId}&timeframe=${frame}`);
            if (!response.ok) {
                throw new Error('Failed to fetch report data.');
            }
            const data = await response.json();
            setReportData(data);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
            setReportData(null);
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (selectedProviderId) {
            fetchReportData(selectedProviderId, timeframe);
        } else {
            setIsLoading(false);
            setReportData(null);
        }
    }, [selectedProviderId, timeframe, fetchReportData]);

    const handleProviderChange = (providerId: string) => {
        setSelectedProviderId(providerId);
    };

    const handleExcelExport = () => {
        if (!reportData || !selectedProviderId) {
            toast({ title: "Cannot Export", description: "No data available to export.", variant: "destructive" });
            return;
        }

        const wb = XLSX.utils.book_new();

        const providerName = providers.find(p => p.id === selectedProviderId)?.name || 'Provider';
        const fileName = `${providerName}_Report_${timeframe}_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Sheet 1: Portfolio Summary
        const portfolioData = [
            { Metric: "Total Disbursed", Value: reportData.portfolioSummary.disbursed },
            { Metric: "Total Repaid", Value: reportData.portfolioSummary.repaid },
            { Metric: "Outstanding Loans (as of today)", Value: reportData.portfolioSummary.outstanding },
        ];
        const portfolioWs = XLSX.utils.json_to_sheet(portfolioData);
        XLSX.utils.book_append_sheet(wb, portfolioWs, "Portfolio Summary");

        // Sheet 2: Collections Report
        const collectionsData = [
            { Metric: "Principal Received", Value: reportData.collectionsReport.principal },
            { Metric: "Interest Received", Value: reportData.collectionsReport.interest },
            { Metric: "Service Fee Received", Value: reportData.collectionsReport.servicefee },
            { Metric: "Penalty Received", Value: reportData.collectionsReport.penalty },
            { Metric: "Total Collected", Value: reportData.collectionsReport.total },
        ];
        const collectionsWs = XLSX.utils.json_to_sheet(collectionsData);
        XLSX.utils.book_append_sheet(wb, collectionsWs, "Collections Report");

        // Sheet 3: Income Statement
        const incomeData = [
            { Type: "Accrued", "Service Fees": reportData.incomeStatement.accrued.servicefee, "Interest": reportData.incomeStatement.accrued.interest, "Penalties": reportData.incomeStatement.accrued.penalty },
            { Type: "Collected", "Service Fees": reportData.incomeStatement.collected.servicefee, "Interest": reportData.incomeStatement.collected.interest, "Penalties": reportData.incomeStatement.collected.penalty },
            {},
            { Type: "Net Realized Income", "Value": reportData.incomeStatement.net },
        ];
        const incomeWs = XLSX.utils.json_to_sheet(incomeData);
        XLSX.utils.book_append_sheet(wb, incomeWs, "Income Statement");

        // Sheet 4: Aging Report
        const agingData = [
            { "Days Overdue": "1 - 30", "Number of Loans": reportData.agingReport.buckets['1-30'] },
            { "Days Overdue": "31 - 60", "Number of Loans": reportData.agingReport.buckets['31-60'] },
            { "Days Overdue": "61 - 90", "Number of Loans": reportData.agingReport.buckets['61-90'] },
            { "Days Overdue": "91+", "Number of Loans": reportData.agingReport.buckets['91+'] },
            { "Days Overdue": "Total Overdue Loans", "Number of Loans": reportData.agingReport.totalOverdue },
        ];
        const agingWs = XLSX.utils.json_to_sheet(agingData);
        XLSX.utils.book_append_sheet(wb, agingWs, "Aging Report");
        
        // Sheet 5: Other Metrics
        const otherData = [
            { "Metric": "Fund Utilization Rate", "Value": `${reportData.fundUtilization.toFixed(2)}%` }
        ]
        const otherWs = XLSX.utils.json_to_sheet(otherData);
        XLSX.utils.book_append_sheet(wb, otherWs, "Other Metrics");


        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], { type: "application/octet-stream" }), fileName);
    };

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
                <h2 className="text-3xl font-bold tracking-tight">Provider Reports</h2>
                <div className="flex items-center space-x-2">
                    <Select onValueChange={handleProviderChange} value={selectedProviderId}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Provider" />
                        </SelectTrigger>
                        <SelectContent>
                            {providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <div className="flex items-center p-1 bg-muted rounded-md">
                        {['daily', 'weekly', 'monthly', 'yearly', 'overall'].map(frame => (
                            <Button
                                key={frame}
                                variant={timeframe === frame ? 'default' : 'ghost'}
                                onClick={() => setTimeframe(frame)}
                                className="capitalize h-8 px-3"
                            >
                                {frame}
                            </Button>
                        ))}
                    </div>
                     <Button variant="outline" onClick={handleExcelExport} disabled={!reportData}>
                        <Download className="mr-2 h-4 w-4" /> Export to Excel
                    </Button>
                </div>
            </div>

            {isLoading ? <LoadingSkeleton /> : !reportData ? (
                 <div className="text-center py-16 text-muted-foreground">
                    <p>No data available for this provider or timeframe.</p>
                    <p className="text-sm">Please select a provider to view reports.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ReportCard title="Portfolio Summary" description="Overview of loan disbursements and repayments.">
                            {timeframe === 'daily' ? (
                                <ReportRow label="Outstanding Loans (as of today)" value={formatCurrency(reportData.portfolioSummary.outstanding)} />
                            ) : (
                                <>
                                    <ReportRow label="Total Disbursed" value={formatCurrency(reportData.portfolioSummary.disbursed)} />
                                    <ReportRow label="Total Repaid" value={formatCurrency(reportData.portfolioSummary.repaid)} />
                                </>
                            )}
                        </ReportCard>
                        <ReportCard title="Collections Report" description="Total amounts collected from borrowers.">
                            <ReportRow label="Principal Received" value={formatCurrency(reportData.collectionsReport.principal)} />
                            <ReportRow label="Interest Received" value={formatCurrency(reportData.collectionsReport.interest)} />
                            <ReportRow label="Service Fee Received" value={formatCurrency(reportData.collectionsReport.servicefee)} />
                            <ReportRow label="Penalty Received" value={formatCurrency(reportData.collectionsReport.penalty)} />
                            <Separator className="my-2"/>
                            <ReportRow label="Total Collected" value={formatCurrency(reportData.collectionsReport.total)} />
                        </ReportCard>
                    </div>

                    <ReportCard title="Income Statement" description="Accrued vs. collected income.">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <h4 className="font-semibold text-sm mb-2">Accrued Income</h4>
                                <ReportRow label="Service Fees" value={formatCurrency(reportData.incomeStatement.accrued.servicefee)} />
                                <ReportRow label="Interest" value={formatCurrency(reportData.incomeStatement.accrued.interest)} />
                                <ReportRow label="Penalties" value={formatCurrency(reportData.incomeStatement.accrued.penalty)} />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm mb-2">Collected Income</h4>
                                <ReportRow label="Service Fees" value={formatCurrency(reportData.incomeStatement.collected.servicefee)} />
                                <ReportRow label="Interest" value={formatCurrency(reportData.incomeStatement.collected.interest)} />
                                <ReportRow label="Penalties" value={formatCurrency(reportData.incomeStatement.collected.penalty)} />
                            </div>
                            <div>
                                 <h4 className="font-semibold text-sm mb-2">Net Realized Income</h4>
                                 <div className="p-4 bg-muted rounded-md h-full flex items-center justify-center">
                                    <span className="text-xl font-bold">{formatCurrency(reportData.incomeStatement.net)}</span>
                                 </div>
                            </div>
                        </div>
                    </ReportCard>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ReportCard title="Fund Utilization" description="Percentage of starting capital disbursed.">
                            <ReportRow label="Utilization Rate" value={`${reportData.fundUtilization.toFixed(2)}%`} />
                        </ReportCard>
                        <ReportCard title="Aging Report (Overdue Loans)" description="Snapshot of overdue loans as of today.">
                             <ReportRow label="1 - 30 Days" value={reportData.agingReport.buckets['1-30']} />
                             <ReportRow label="31 - 60 Days" value={reportData.agingReport.buckets['31-60']} />
                             <ReportRow label="61 - 90 Days" value={reportData.agingReport.buckets['61-90']} />
                             <ReportRow label="91+" value={reportData.agingReport.buckets['91+']} />
                              <Separator className="my-2"/>
                             <ReportRow label="Total Overdue Loans" value={reportData.agingReport.totalOverdue} />
                        </ReportCard>
                    </div>
                </div>
            )}
        </div>
    );
}
