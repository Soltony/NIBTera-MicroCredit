

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, File as FileIcon, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoanProvider, type LoanReportData, type CollectionsReportData, type IncomeReportData, ProviderReportData } from '@/lib/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { DateRange } from 'react-day-picker';


const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};


const TIMEFRAMES = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'This Week' },
    { value: 'monthly', label: 'This Month' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'semiAnnually', label: 'Semi-Annually' },
    { value: 'annually', label: 'Annually' },
    { value: 'overall', label: 'Overall' },
];

export function ReportsClient({ providers }: { providers: LoanProvider[] }) {
    const { toast } = useToast();
    const { currentUser, isLoading: isAuthLoading } = useAuth();

    const [timeframe, setTimeframe] = useState('overall');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [providerId, setProviderId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('providerReport');
    
    const [loansData, setLoansData] = useState<LoanReportData[]>([]);
    const [collectionsData, setCollectionsData] = useState<CollectionsReportData[]>([]);
    const [incomeData, setIncomeData] = useState<IncomeReportData[]>([]);
    const [disbursementsData, setDisbursementsData] = useState<any[]>([]);
    const [repaymentsData, setRepaymentsData] = useState<any[]>([]);
    const [providerSummaryData, setProviderSummaryData] = useState<Record<string, ProviderReportData>>({});
    
    const isSuperAdminOrRecon = currentUser?.role === 'Super Admin' || currentUser?.role === 'Reconciliation';


    const fetchAllReportData = useCallback(async (currentProviderId: string, currentTimeframe: string, currentDateRange?: DateRange) => {
        setIsLoading(true);
        try {
            const fetchDataForTab = async (url: string) => {
                const response = await fetch(url);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Failed to fetch data.`);
                }
                return response.json();
            };

            const buildUrl = (baseUrl: string) => {
                const params = new URLSearchParams({
                    providerId: currentProviderId,
                    timeframe: currentTimeframe,
                });
                if (currentDateRange?.from) {
                    params.set('from', currentDateRange.from.toISOString());
                }
                if (currentDateRange?.to) {
                    params.set('to', currentDateRange.to.toISOString());
                }
                return `${baseUrl}?${params.toString()}`;
            }

            const loansPromise = fetchDataForTab(buildUrl('/api/reports/loans'));
            const collectionsPromise = fetchDataForTab(buildUrl('/api/reports/collections'));
            const incomePromise = fetchDataForTab(buildUrl('/api/reports/income'));
            const disbursementsPromise = fetchDataForTab(buildUrl('/api/reports/transactions') + '&type=disbursement');
            const repaymentsPromise = fetchDataForTab(buildUrl('/api/reports/transactions') + '&type=repayment');
            
            const summaryProviders = (currentProviderId === 'all' && providers.length > 1 && isSuperAdminOrRecon) 
              ? providers 
              : [providers.find(p => p.id === currentProviderId)!].filter(Boolean);

            const summaryPromises = summaryProviders
                .map(p => 
                    fetchDataForTab(buildUrl(`/api/reports/provider-summary`).replace(`providerId=${currentProviderId}`, `providerId=${p.id}`))
                        .then(data => ({ [p.id]: data }))
                        .catch(err => {
                            console.error(`Failed to fetch summary for provider ${p.id}:`, err.message);
                            return { [p.id]: null }; // Return null on error for this provider
                        })
                );
            
            const [loans, collections, income, disbursements, repayments, ...summaryResults] = await Promise.all([
                loansPromise,
                collectionsPromise,
                incomePromise,
                disbursementsPromise,
                repaymentsPromise,
                ...summaryPromises
            ]);

            setLoansData(loans);
            setCollectionsData(collections);
            setIncomeData(income);
            setDisbursementsData(disbursements || []);
            setRepaymentsData(repayments || []);
            
            const newSummaryData = summaryResults.reduce((acc, current) => ({ ...acc, ...current }), {} as Record<string, any>);
            // remove null entries returned when a provider summary failed to fetch
            for (const k of Object.keys(newSummaryData)) {
                if (newSummaryData[k] === null) delete newSummaryData[k];
            }
            setProviderSummaryData(newSummaryData as Record<string, any>);

        } catch (error: any) {
            toast({ title: "Error fetching report data", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, providers, isSuperAdminOrRecon]);
    
    // Effect to set the initial providerId and fetch data ONCE
    useEffect(() => {
        if (isAuthLoading) return; // Wait for user data to be available

        let initialProviderId: string | null = null;
        if (isSuperAdminOrRecon) {
            initialProviderId = 'all';
        } else if (currentUser?.providerId) {
            initialProviderId = currentUser.providerId;
        } else if (providers.length > 0) {
            // This case might be for other roles that see reports but aren't super admin
            initialProviderId = 'all';
        } else {
            initialProviderId = 'none'; // No providers available
        }
        
        setProviderId(initialProviderId);

        if (initialProviderId && initialProviderId !== 'none') {
            fetchAllReportData(initialProviderId, 'overall', undefined);
        } else {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthLoading, currentUser?.providerId, isSuperAdminOrRecon]);
    
    // Effect to refetch data when filters change, but not on initial load
    useEffect(() => {
        // This check prevents refetching on the initial render where providerId is still null
        if (providerId !== null) { 
            fetchAllReportData(providerId, timeframe, dateRange);
        }
    }, [providerId, timeframe, dateRange, fetchAllReportData]);

    
    const handleExcelExport = async () => {
        const wb = new ExcelJS.Workbook();
        const providerList = (providerId === 'all' ? providers : [providers.find(p => p.id === providerId)!]).filter(Boolean);

        // 1. Provider Loans
        if (loansData.length > 0) {
            const providerLoanData = loansData.map(d => ({
                Provider: d.provider,
                'Loan ID': d.loanId,
                Borrower: d.borrowerName,
                'Principal Disbursed': d.principalDisbursed,
                'Principal Outstanding': d.principalOutstanding,
                'Interest (Daily Fee) Outstanding': d.interestOutstanding,
                'Service Fee Outstanding': d.serviceFeeOutstanding,
                'Penalty Outstanding': d.penaltyOutstanding,
                'Total Outstanding': d.totalOutstanding,
                Status: d.status,
            }));
            const wsProvider = wb.addWorksheet('Provider Loans');
            if (providerLoanData.length > 0) {
                wsProvider.columns = Object.keys(providerLoanData[0]).map(k => ({ header: k, key: k }));
                providerLoanData.forEach(r => wsProvider.addRow(r));
            }
        }

        // 2. Collections
        if (collectionsData.length > 0) {
            const collectionsExportData = collectionsData.map(d => ({
                'Provider': d.provider,
                'Date': format(new Date(d.date), 'yyyy-MM-dd'),
                'Principal Received': d.principal,
                'Interest Received': d.interest,
                'Service Fee Received': d.serviceFee,
                'Penalty Received': d.penalty,
                'Tax Received': d.tax,
                'Total Collected': d.total,
            }));
            const ws = wb.addWorksheet('Collections');
            if (collectionsExportData.length > 0) {
                ws.columns = Object.keys(collectionsExportData[0]).map(k => ({ header: k, key: k }));
                collectionsExportData.forEach(r => ws.addRow(r));
            }
        }
        
        // 3. Income
        if (incomeData.length > 0) {
            const incomeExportData = incomeData.map(d => ({
                'Provider': d.provider,
                'Accrued Interest': d.accruedInterest,
                'Collected Interest': d.collectedInterest,
                'Accrued Service Fee': d.accruedServiceFee,
                'Collected Service Fee': d.collectedServiceFee,
                'Accrued Penalty': d.accruedPenalty,
                'Collected Penalty': d.collectedPenalty,
                'Total Accrued': d.accruedInterest + d.accruedServiceFee + d.accruedPenalty,
                'Total Collected': d.collectedInterest + d.collectedServiceFee + d.collectedPenalty,
            }));
            const ws = wb.addWorksheet('Income');
            if (incomeExportData.length > 0) {
                ws.columns = Object.keys(incomeExportData[0]).map(k => ({ header: k, key: k }));
                incomeExportData.forEach(r => ws.addRow(r));
            }
        }
        
        // 4. Fund Utilization
        const utilizationExportData = providerList.map(p => {
            const data = providerSummaryData[p.id];
            if (!data) return null;
            const availableFund = p.initialBalance - data.portfolioSummary.outstanding;
            return {
                'Provider': p.name,
                'Provider Fund': p.initialBalance,
                'Loans Disbursed': data.portfolioSummary.disbursed,
                'Outstanding Principal': data.portfolioSummary.outstanding,
                'Available Fund': availableFund,
                'Utilization %': data.fundUtilization,
            };
        }).filter(Boolean);
        if (utilizationExportData.length > 0) {
            const ws = wb.addWorksheet('Fund Utilization');
            if (utilizationExportData.length > 0) {
                ws.columns = Object.keys(utilizationExportData[0]).map(k => ({ header: k, key: k }));
                utilizationExportData.forEach(r => ws.addRow(r));
            }
        }

        // 5. Disbursements
        if (disbursementsData.length > 0) {
                    const disbExport = disbursementsData.map((r: any) => {
                const loanAmt = r.principalDisbursed || 0;
                const interestFee = r.interestOutstanding || 0;
                const serviceFee = r.serviceFeeOutstanding || 0;
                // Prefer API-provided netDisbursed (principal) when available.
                const netDisbursed = r.netDisbursed != null ? r.netDisbursed : loanAmt;
                const cbsCredit = r.cbsCreditAmount ?? 0;
                const diff = netDisbursed - cbsCredit;
                return {
                    Provider: r.provider,
                    Date: r.transactionDate ? new Date(r.transactionDate).toISOString() : '',
                    'Loan ID': r.loanId,
                    'Customer Name': r.customerName || r.borrowerName || r.borrowerAccount || r.borrowerId || '',
                    'Debit Account': r.debitAccount,
                    'Credit Account (Customer Account)': r.borrowerAccount || r.creditAccount,
                    'Txn Status': r.disbursementOutcome || r.disbursementStatusText || r.transactionStatus,
                    'CBS Reference': r.cbsReference || r.reference,
                    'Loan Amount (MLS)': loanAmt,
                    'Interest Fee (MLS)': interestFee,
                    'Service Fee (MLS)': serviceFee,
                    'Net Disbursed (MLS)': netDisbursed,
                    'CBS Credit Amount': cbsCredit,
                    'Due Date': r.dueDate ? new Date(r.dueDate).toISOString() : '',
                    'Difference': diff,
                };
            });
            const ws = wb.addWorksheet('Disbursements');
            if (disbExport.length > 0) {
                ws.columns = Object.keys(disbExport[0]).map(k => ({ header: k, key: k }));
                disbExport.forEach((r: any) => ws.addRow(r));
            }
        }

        // 6. Repayments
        if (repaymentsData.length > 0) {
                const repExport = repaymentsData.map((r: any) => ({
                    Provider: r.provider,
                    'Loan ID': r.loanId,
                    'Customer Name': r.customerName || r.borrowerName || r.borrowerAccount || r.borrowerId || '',
                'Transaction Date': r.transactionDate ? new Date(r.transactionDate).toISOString() : '',
                'Due Date': r.dueDate ? new Date(r.dueDate).toISOString() : '',
                'Debit Account': r.debitAccount,
                    'Credit Account': r.borrowerAccount || r.creditAccount,
                'Txn Status': r.transactionStatus,
                Reference: r.reference,
                'Product Type': r.productType,
                Borrower: r.borrowerId,
                'Principal Disbursed': r.principalDisbursed,
                'Principal Outstanding': r.principalOutstanding,
                'Interest Outstanding': r.interestOutstanding,
                'Service Fee Outstanding': r.serviceFeeOutstanding,
                'Penalty Outstanding': r.penaltyOutstanding,
                'Total Outstanding': r.totalOutstanding,
                Status: r.status,
            }));
            const ws = wb.addWorksheet('Repayments');
            if (repExport.length > 0) {
                ws.columns = Object.keys(repExport[0]).map(k => ({ header: k, key: k }));
                repExport.forEach((r: any) => ws.addRow(r));
            }
        }
        
        // 5. Aging Report
        const agingExportData = providerList.map(p => {
            const data = providerSummaryData[p.id];
            if (!data) return null;
            const aging = data.agingReport;
            return {
                'Provider': p.name,
                'Pass (0-29 Days)': aging?.buckets?.Pass || 0,
                'Special Mention (30-89 Days)': aging?.buckets?.['Special Mention'] || 0,
                'Substandard (90-179 Days)': aging?.buckets?.Substandard || 0,
                'Doubtful (180-359 Days)': aging?.buckets?.Doubtful || 0,
                'Loss (360+ Days)': aging?.buckets?.Loss || 0,
                'Total Overdue': aging?.totalOverdue || 0,
            };
        }).filter(Boolean);
        if (agingExportData.length > 0) {
            const ws = wb.addWorksheet('Aging Report');
            if (agingExportData.length > 0) {
                ws.columns = Object.keys(agingExportData[0]).map(k => ({ header: k, key: k }));
                agingExportData.forEach((r: any) => ws.addRow(r));
            }
        }

        // Borrower-level Aging export (flattened across providers)
        const borrowerAgingExport: any[] = [];
        providerList.forEach(p => {
            const data = providerSummaryData[p.id];
            const borrowers = data?.agingReport?.byBorrower || [];
                borrowers.forEach((b: any) => {
                borrowerAgingExport.push({
                    Provider: p.name,
                    'Borrower': b.borrowerId,
                    'Borrower Account': b.borrowerAccount || '',
                    'Borrower Name': b.borrowerName || '',
                    'Days Overdue': b.daysOverdue ?? '',
                    'Category': b.classification || '',
                    'Amount': b.classificationAmount || b.totalOverdue || 0,
                });
            });
        });
        if (borrowerAgingExport.length > 0) {
            const wsB = wb.addWorksheet('Borrower Aging');
            if (borrowerAgingExport.length > 0) {
                wsB.columns = Object.keys(borrowerAgingExport[0]).map(k => ({ header: k, key: k }));
                borrowerAgingExport.forEach(r => wsB.addRow(r));
            }
        }
        
        // 6. Borrower Performance
        if (loansData.length > 0) {
            const borrowerPerfData = loansData.map(d => ({
                 'Borrower ID': d.borrowerId,
                 'Borrower Name': d.borrowerName,
                 'Loan ID': d.loanId,
                 'Principal Disbursed': d.principalDisbursed,
                 'Principal Outstanding': d.principalOutstanding,
                 'Interest Outstanding': d.interestOutstanding,
                 'Service Fee Outstanding': d.serviceFeeOutstanding,
                 'Penalty Outstanding': d.penaltyOutstanding,
                 'Days in Arrears': d.daysInArrears,
                 'Status': d.status,
            }));
            const wsBorrower = wb.addWorksheet('Borrower Performance');
            if (borrowerPerfData.length > 0) {
                wsBorrower.columns = Object.keys(borrowerPerfData[0]).map(k => ({ header: k, key: k }));
                borrowerPerfData.forEach(r => wsBorrower.addRow(r));
            }
        }

        // If workbook has no worksheets (no data), inform the user
        if (wb.worksheets.length === 0) {
            toast({ description: 'No data available to export.', variant: 'destructive' });
            return;
        }

        try {
            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `LoanFlow_Report_${timeframe}_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error('Failed to generate Excel file', err);
            toast({ title: 'Export Failed', description: 'Could not generate Excel file.', variant: 'destructive' });
        }
    }
    
    if (isLoading || isAuthLoading || providerId === null) {
        return (
             <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
                    <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
                </div>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </div>
        )
    }

    if (providerId === 'none') {
         return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>Access Restricted</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">You are not currently associated with a loan provider. Please contact an administrator to get access to reports.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
                <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
                <div className="flex items-center space-x-2">
                    <Select onValueChange={(value) => { setTimeframe(value); setDateRange(undefined); }} value={timeframe}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIMEFRAMES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                                "w-[300px] justify-start text-left font-normal",
                                !dateRange && "text-muted-foreground"
                            )}
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                                dateRange.to ? (
                                <>
                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                    {format(dateRange.to, "LLL dd, y")}
                                </>
                                ) : (
                                format(dateRange.from, "LLL dd, y")
                                )
                            ) : (
                                <span>Pick a date</span>
                            )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={(range) => { setDateRange(range); if (range?.from) setTimeframe('custom'); }}
                            numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                     {isSuperAdminOrRecon && (
                        <Select onValueChange={setProviderId} value={providerId || ''}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select Provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Providers</SelectItem>
                                {providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                     )}
                    <Button variant="outline" onClick={handleExcelExport}><Download className="mr-2 h-4 w-4"/>Excel</Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="providerReport">Provider Loans</TabsTrigger>
                    <TabsTrigger value="disbursementsReport">Disbursements</TabsTrigger>
                    <TabsTrigger value="repaymentsReport">Repayments</TabsTrigger>
                    <TabsTrigger value="collectionsReport">Collections</TabsTrigger>
                    <TabsTrigger value="incomeReport">Income</TabsTrigger>
                    <TabsTrigger value="utilizationReport">Fund Utilization</TabsTrigger>
                    <TabsTrigger value="agingReport">Aging</TabsTrigger>
                    <TabsTrigger value="borrowerReport">Borrower Performance</TabsTrigger>
                </TabsList>
                <div className="overflow-auto rounded-md border h-[60vh]">
                    <TabsContent value="providerReport" className="space-y-4 m-0">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead>Loan ID</TableHead>
                                    <TableHead>Borrower</TableHead>
                                    <TableHead className="text-right">Principal Disbursed</TableHead>
                                    <TableHead className="text-right">Principal Outstanding</TableHead>
                                    <TableHead className="text-right">Interest Outstanding</TableHead>
                                    <TableHead className="text-right">Service Fee Outstanding</TableHead>
                                    <TableHead className="text-right">Penalty Outstanding</TableHead>
                                    <TableHead className="text-right">Total Outstanding</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                        </TableCell>
                                    </TableRow>
                                ) : loansData.length > 0 ? (
                                    loansData.map((row) => (
                                        <TableRow key={row.loanId}>
                                            <TableCell>{row.provider}</TableCell>
                                            <TableCell>{row.loanId.slice(-8)}</TableCell>
                                            <TableCell>{row.borrowerName}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principalDisbursed)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principalOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.interestOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.serviceFeeOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.penaltyOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">{formatCurrency(row.totalOutstanding)}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    row.status === 'Overdue' || row.status === 'Defaulted' ? 'destructive' :
                                                    row.status === 'Paid' ? 'default' : 'secondary'
                                                }
                                                className={cn(row.status === 'Paid' && 'bg-green-600 text-white')}
                                                >
                                                    {row.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">
                                            No results found for the selected filters.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="disbursementsReport">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Loan ID</TableHead>
                                            <TableHead>Customer Name</TableHead>
                                            <TableHead>Debit Account</TableHead>
                                            <TableHead>Credit Account (Customer Account)</TableHead>
                                            <TableHead>Txn Status</TableHead>
                                            <TableHead>CBS Reference</TableHead>
                                            <TableHead className="text-right">Loan Amount (MLS)</TableHead>
                                            <TableHead className="text-right">Interest Fee (MLS)</TableHead>
                                            <TableHead className="text-right">Service Fee (MLS)</TableHead>
                                            <TableHead className="text-right">Net Disbursed (MLS)</TableHead>
                                            <TableHead className="text-right">CBS Credit Amount</TableHead>
                                            <TableHead>Due Date</TableHead>
                                            <TableHead className="text-right">Difference</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow><TableCell colSpan={13} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                        ) : disbursementsData.length > 0 ? (
                                            disbursementsData.map((row) => {
                                                                                const loanAmt = row.principalDisbursed || 0;
                                                                                const interestFee = row.interestOutstanding || 0;
                                                                                const serviceFee = row.serviceFeeOutstanding || 0;
                                                                                const netDisbursed = row.netDisbursed != null ? row.netDisbursed : loanAmt;
                                                const cbsCredit = row.cbsCreditAmount ?? 0;
                                                const diff = netDisbursed - cbsCredit;
                                                return (
                                                <TableRow key={row.reference}>
                                                    <TableCell>{row.transactionDate ? format(new Date(row.transactionDate), 'yyyy-MM-dd') : ''}</TableCell>
                                                    <TableCell>{row.loanId?.slice(-8)}</TableCell>
                                                    <TableCell>{row.customerName || row.borrowerName || row.borrowerAccount || row.borrowerId || ''}</TableCell>
                                                    <TableCell className="font-mono">{row.debitAccount}</TableCell>
                                                    <TableCell className="font-mono">{row.borrowerAccount || row.creditAccount}</TableCell>
                                                    <TableCell>{row.disbursementOutcome || row.disbursementStatusText || row.transactionStatus}</TableCell>
                                                    
                                                    <TableCell>{row.cbsReference || row.reference}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatCurrency(loanAmt)}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatCurrency(interestFee)}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatCurrency(serviceFee)}</TableCell>
                                                    <TableCell className="text-right font-mono font-bold">{formatCurrency(netDisbursed)}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatCurrency(cbsCredit)}</TableCell>
                                                    <TableCell>{row.dueDate ? format(new Date(row.dueDate), 'yyyy-MM-dd') : ''}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatCurrency(diff)}</TableCell>
                                                </TableRow>
                                            )})
                                        ) : (
                                            <TableRow><TableCell colSpan={13} className="h-24 text-center">No results found for the selected filters.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="repaymentsReport">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead>Loan ID</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Transaction Date</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead>Debit Account</TableHead>
                                    <TableHead>Credit Account</TableHead>
                                    <TableHead>Txn Status</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Product Type</TableHead>
                                    <TableHead>Borrower</TableHead>
                                    <TableHead className="text-right">Principal Disbursed</TableHead>
                                    <TableHead className="text-right">Principal Outstanding</TableHead>
                                    <TableHead className="text-right">Interest Outstanding</TableHead>
                                    <TableHead className="text-right">Service Fee Outstanding</TableHead>
                                    <TableHead className="text-right">Penalty Outstanding</TableHead>
                                    <TableHead className="text-right">Total Outstanding</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={18} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : repaymentsData.length > 0 ? (
                                    repaymentsData.map((row) => (
                                        <TableRow key={row.reference}>
                                            <TableCell>{row.provider}</TableCell>
                                            <TableCell>{row.loanId?.slice(-8)}</TableCell>
                                            <TableCell>{row.customerName || row.borrowerName || row.borrowerAccount || row.borrowerId || ''}</TableCell>
                                            <TableCell>{row.transactionDate ? format(new Date(row.transactionDate), 'yyyy-MM-dd') : ''}</TableCell>
                                            <TableCell>{row.dueDate ? format(new Date(row.dueDate), 'yyyy-MM-dd') : ''}</TableCell>
                                            <TableCell>{row.debitAccount}</TableCell>
                                            <TableCell>{row.borrowerAccount || row.creditAccount}</TableCell>
                                            <TableCell>{row.transactionStatus}</TableCell>
                                            <TableCell>{row.reference}</TableCell>
                                            <TableCell>{row.productType}</TableCell>
                                            <TableCell>{row.borrowerId?.slice(-8)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principalDisbursed)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principalOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.interestOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.serviceFeeOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.penaltyOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">{formatCurrency(row.totalOutstanding)}</TableCell>
                                            <TableCell><Badge variant={row.status === 'Overdue' || row.status === 'Defaulted' ? 'destructive' : row.status === 'Paid' ? 'default' : 'secondary'}>{row.status}</Badge></TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={18} className="h-24 text-center">No results found for the selected filters.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="collectionsReport">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Principal Received</TableHead>
                                    <TableHead className="text-right">Interest Received</TableHead>
                                    <TableHead className="text-right">Service Fee Received</TableHead>
                                    <TableHead className="text-right">Penalty Received</TableHead>
                                    <TableHead className="text-right">Tax Received</TableHead>
                                    <TableHead className="text-right font-bold">Total Collected</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : collectionsData.length > 0 ? (
                                    collectionsData.map((row) => (
                                        <TableRow key={`${row.provider}-${row.date}`}>
                                            <TableCell>{row.provider}</TableCell>
                                            <TableCell>{format(new Date(row.date), 'yyyy-MM-dd')}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principal)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.interest)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.serviceFee)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.penalty)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.tax)}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">{formatCurrency(row.total)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="incomeReport">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead className="text-right">Accrued Interest</TableHead>
                                    <TableHead className="text-right">Collected Interest</TableHead>
                                    <TableHead className="text-right">Accrued Service Fee</TableHead>
                                    <TableHead className="text-right">Collected Service Fee</TableHead>
                                    <TableHead className="text-right">Accrued Penalty</TableHead>
                                    <TableHead className="text-right">Collected Penalty</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : incomeData.length > 0 ? (
                                    incomeData.map((row) => (
                                        <TableRow key={row.provider}>
                                            <TableCell>{row.provider}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.accruedInterest)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.collectedInterest)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.accruedServiceFee)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.collectedServiceFee)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.accruedPenalty)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.collectedPenalty)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="utilizationReport">
                        <Table>
                                <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead className="text-right">Provider Fund</TableHead>
                                    <TableHead className="text-right">Loans Disbursed</TableHead>
                                    <TableHead className="text-right">Available Fund</TableHead>
                                    <TableHead className="text-right">Utilization %</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : providers.filter(p => providerId === 'all' || p.id === providerId).length > 0 ? (
                                    providers.filter(p => providerId === 'all' || p.id === providerId).map(provider => {
                                        const data = providerSummaryData[provider.id];
                                        if (!data) return <TableRow key={provider.id}><TableCell colSpan={5} className="text-center h-12">No data for {provider.name}</TableCell></TableRow>;
                                        const availableFund = provider.initialBalance - data.portfolioSummary.outstanding;
                                        return (
                                        <TableRow key={provider.id}>
                                            <TableCell>{provider.name}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(provider.initialBalance)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(data?.portfolioSummary.disbursed || 0)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(availableFund)}</TableCell>
                                            <TableCell className="text-right font-mono">{data?.fundUtilization.toFixed(2) || '0.00'}%</TableCell>
                                        </TableRow>
                                    )})
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="agingReport">
                        <Table>
                                <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead className="text-right">Pass (0-29 Days)</TableHead>
                                    <TableHead className="text-right">Special Mention (30-89 Days)</TableHead>
                                    <TableHead className="text-right">Substandard (90-179 Days)</TableHead>
                                    <TableHead className="text-right">Doubtful (180-359 Days)</TableHead>
                                    <TableHead className="text-right">Loss (360+ Days)</TableHead>
                                    <TableHead className="text-right">Total Overdue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : providers.filter(p => providerId === 'all' || p.id === providerId).length > 0 ? (
                                    providers.filter(p => providerId === 'all' || p.id === providerId).map(provider => {
                                        const data = providerSummaryData[provider.id];
                                        if (!data) return <TableRow key={provider.id}><TableCell colSpan={7} className="text-center h-12">No data for {provider.name}</TableCell></TableRow>;
                                        const aging = data?.agingReport;
                                        return (
                                        <TableRow key={provider.id}>
                                            <TableCell>{provider.name}</TableCell>
                                            <TableCell className="text-right font-mono">{aging?.buckets?.Pass || 0}</TableCell>
                                            <TableCell className="text-right font-mono">{aging?.buckets?.['Special Mention'] || 0}</TableCell>
                                            <TableCell className="text-right font-mono">{aging?.buckets?.Substandard || 0}</TableCell>
                                            <TableCell className="text-right font-mono">{aging?.buckets?.Doubtful || 0}</TableCell>
                                            <TableCell className="text-right font-mono">{aging?.buckets?.Loss || 0}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">{aging?.totalOverdue || 0}</TableCell>
                                        </TableRow>
                                    )})
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                            {/* Borrower-level aging breakdown when a single provider is selected */}
                            {providerId && providerId !== 'all' && (() => {
                                const pdata = providerSummaryData[providerId];
                                const borrowers = pdata?.agingReport?.byBorrower || [];
                                return (
                                    <div className="mt-6">
                                        <h3 className="text-lg font-medium mb-2">Borrower-level Aging</h3>
                                        <Table>
                                                    <TableHeader className="sticky top-0 bg-card z-10">
                                                        <TableRow>
                                                            <TableHead className="text-left">Borrower</TableHead>
                                                            <TableHead className="text-center">Account Number</TableHead>
                                                            <TableHead className="text-center">Days Overdue</TableHead>
                                                            <TableHead className="text-center">Category</TableHead>
                                                            <TableHead className="text-right">Amount</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                <TableBody>
                                                    {borrowers.length === 0 ? (
                                                        <TableRow><TableCell colSpan={4} className="h-24 text-center">No borrower-level aging data.</TableCell></TableRow>
                                                    ) : borrowers.map((b: any) => (
                                                        <TableRow key={b.borrowerId}>
                                                            <TableCell className="font-medium">{b.borrowerId}</TableCell>
                                                            <TableCell className="text-center font-mono text-sm">{b.borrowerAccount || ''}</TableCell>
                                                            <TableCell className="text-center">{b.daysOverdue ?? '-'}</TableCell>
                                                            <TableCell className="text-center">{b.classification || 'N/A'}</TableCell>
                                                            <TableCell className="text-right font-mono font-bold">{formatCurrency(b.classificationAmount || b.totalOverdue || 0)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                        </Table>
                                    </div>
                                );
                            })()}
                    </TabsContent>
                    <TabsContent value="borrowerReport">
                        <Table>
                                <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Borrower ID</TableHead>
                                    <TableHead>Borrower Name</TableHead>
                                    <TableHead>Loan ID</TableHead>
                                    <TableHead className="text-right">Principal Disbursed</TableHead>
                                    <TableHead className="text-right">Principal Outstanding</TableHead>
                                    <TableHead className="text-right">Interest Outstanding</TableHead>
                                    <TableHead className="text-right">Service Fee Outstanding</TableHead>
                                    <TableHead className="text-right">Penalty Outstanding</TableHead>
                                    <TableHead className="text-right">Days in Arrears</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                                <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={10} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : loansData.length > 0 ? (
                                    loansData.map((row) => (
                                        <TableRow key={row.loanId}>
                                            <TableCell>{row.borrowerId.slice(-8)}</TableCell>
                                            <TableCell>{row.borrowerName}</TableCell>
                                            <TableCell>{row.loanId.slice(-8)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principalDisbursed)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principalOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.interestOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.serviceFeeOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.penaltyOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{row.daysInArrears}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    row.status === 'Overdue' || row.status === 'Defaulted' ? 'destructive' :
                                                    row.status === 'Paid' ? 'default' : 'secondary'
                                                }
                                                className={cn(row.status === 'Paid' && 'bg-green-600 text-white')}
                                                >
                                                    {row.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                                </TableBody>
                        </Table>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
