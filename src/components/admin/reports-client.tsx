
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, File as FileIcon, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoanProvider, type LoanReportData, type CollectionsReportData, type IncomeReportData, ProviderReportData } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';


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
    { value: 'yearly', label: 'This Year' },
    { value: 'overall', label: 'Overall' },
];

export function ReportsClient({ providers }: { providers: LoanProvider[] }) {
    const { toast } = useToast();
    const [timeframe, setTimeframe] = useState('overall');
    const [providerId, setProviderId] = useState('all');
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('providerReport');
    
    const [loansData, setLoansData] = useState<LoanReportData[]>([]);
    const [collectionsData, setCollectionsData] = useState<CollectionsReportData[]>([]);
    const [incomeData, setIncomeData] = useState<IncomeReportData[]>([]);
    const [providerSummaryData, setProviderSummaryData] = useState<Record<string, ProviderReportData>>({});


    const fetchReportData = useCallback(async (tab: string, currentProviderId: string, currentTimeframe: string) => {
        setIsLoading(true);
        try {
            let endpoint = '';
            
            const fetchDataForTab = async (url: string) => {
                const response = await fetch(url);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Failed to fetch data for ${tab}.`);
                }
                return response.json();
            }

            switch (tab) {
                case 'providerReport':
                case 'borrowerReport':
                    endpoint = `/api/reports/loans?providerId=${currentProviderId}&timeframe=${currentTimeframe}`;
                    setLoansData(await fetchDataForTab(endpoint));
                    break;
                case 'collectionsReport':
                    endpoint = `/api/reports/collections?providerId=${currentProviderId}&timeframe=${currentTimeframe}`;
                    setCollectionsData(await fetchDataForTab(endpoint));
                    break;
                 case 'incomeReport':
                    endpoint = `/api/reports/income?providerId=${currentProviderId}&timeframe=${currentTimeframe}`;
                    setIncomeData(await fetchDataForTab(endpoint));
                    break;
                 case 'utilizationReport':
                 case 'agingReport':
                    const summaryPromises = (currentProviderId === 'all' ? providers : [providers.find(p => p.id === currentProviderId)!])
                        .filter(Boolean)
                        .map(p => 
                            fetchDataForTab(`/api/reports/provider-summary?providerId=${p.id}&timeframe=${currentTimeframe}`)
                                .then(data => ({ [p.id]: data }))
                        );
                    const results = await Promise.all(summaryPromises);
                    const newSummaryData = results.reduce((acc, current) => ({ ...acc, ...current }), {});
                    setProviderSummaryData(prev => ({...prev, ...newSummaryData}));
                    break;
                default:
                    break;
            }
            
        } catch (error: any) {
            toast({ title: "Error fetching data", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, providers]);
    
    // Effect to refetch data when filters change
    useEffect(() => {
        fetchReportData(activeTab, providerId, timeframe);
    }, [activeTab, providerId, timeframe, fetchReportData]);

    
    const handleExcelExport = () => {
        const wb = XLSX.utils.book_new();
        const providerList = (providerId === 'all' ? providers : [providers.find(p => p.id === providerId)!]).filter(Boolean);

        // 1. Provider Loans
        if (loansData.length > 0) {
            const providerLoanData = loansData.map(d => ({
                'Provider': d.provider,
                'Loan ID': d.loanId,
                'Borrower': d.borrowerName,
                'Principal Disbursed': d.principalDisbursed,
                'Principal Outstanding': d.principalOutstanding,
                'Interest (Daily Fee) Outstanding': d.interestOutstanding,
                'Service Fee Outstanding': d.serviceFeeOutstanding,
                'Penalty Outstanding': d.penaltyOutstanding,
                'Total Outstanding': d.totalOutstanding,
                'Status': d.status,
            }));
            const wsProvider = XLSX.utils.json_to_sheet(providerLoanData);
            XLSX.utils.book_append_sheet(wb, wsProvider, "Provider Loans");
        }

        // 2. Collections
        if (collectionsData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(collectionsData);
            XLSX.utils.book_append_sheet(wb, ws, "Collections");
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
            const ws = XLSX.utils.json_to_sheet(incomeExportData);
            XLSX.utils.book_append_sheet(wb, ws, "Income");
        }
        
        // 4. Fund Utilization
        const utilizationData = providerList.map(p => {
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
             }
        }).filter(Boolean);

        if (utilizationData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(utilizationData);
            XLSX.utils.book_append_sheet(wb, ws, "Fund Utilization");
        }
        
        // 5. Aging Report
        const agingData = providerList.map(p => {
            const data = providerSummaryData[p.id];
            if (!data) return null;
            const aging = data.agingReport;
            return {
                'Provider': p.name,
                '0-30 Days': aging.buckets['1-30'],
                '31-60 Days': aging.buckets['31-60'],
                '61-90 Days': aging.buckets['91+'],
                'Total Overdue': aging.totalOverdue,
            }
        }).filter(Boolean);
        
        if (agingData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(agingData);
            XLSX.utils.book_append_sheet(wb, ws, "Aging Report");
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
            const wsBorrower = XLSX.utils.json_to_sheet(borrowerPerfData);
            XLSX.utils.book_append_sheet(wb, wsBorrower, "Borrower Performance");
        }
        
        if (wb.SheetNames.length === 0) {
            toast({ description: "No data available to export.", variant: "destructive" });
            return;
        }

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], { type: "application/octet-stream" }), `LoanFlow_Report_${timeframe}_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
    
    const renderProviderList = () => (providerId === 'all' ? providers : [providers.find(p => p.id === providerId)!]).filter(Boolean);


    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
                <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
                <div className="flex items-center space-x-2">
                    <Select onValueChange={setTimeframe} value={timeframe}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIMEFRAMES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select onValueChange={setProviderId} value={providerId}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Provider" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Providers</SelectItem>
                            {providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleExcelExport}><Download className="mr-2 h-4 w-4"/>Excel</Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="providerReport">Provider Loans</TabsTrigger>
                    <TabsTrigger value="collectionsReport">Collections</TabsTrigger>
                    <TabsTrigger value="incomeReport">Income</TabsTrigger>
                    <TabsTrigger value="utilizationReport">Fund Utilization</TabsTrigger>
                    <TabsTrigger value="agingReport">Aging</TabsTrigger>
                    <TabsTrigger value="borrowerReport">Borrower Performance</TabsTrigger>
                </TabsList>
                <TabsContent value="providerReport" className="space-y-4">
                    <div className="overflow-auto rounded-md border h-[60vh]">
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
                                    Array.from({ length: 10 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={10} className="text-center p-4">
                                                 <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                            </TableCell>
                                        </TableRow>
                                    ))
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
                    </div>
                </TabsContent>
                <TabsContent value="collectionsReport">
                     <div className="overflow-auto rounded-md border h-[60vh]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Principal Received</TableHead>
                                    <TableHead className="text-right">Interest Received</TableHead>
                                    <TableHead className="text-right">Service Fee Received</TableHead>
                                    <TableHead className="text-right">Penalty Received</TableHead>
                                    <TableHead className="text-right font-bold">Total Collected</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : collectionsData.length > 0 ? (
                                    collectionsData.map((row) => (
                                        <TableRow key={`${row.provider}-${row.date}`}>
                                            <TableCell>{row.provider}</TableCell>
                                            <TableCell>{format(new Date(row.date), 'yyyy-MM-dd')}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principal)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.interest)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.serviceFee)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.penalty)}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">{formatCurrency(row.total)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
                 <TabsContent value="incomeReport">
                     <div className="overflow-auto rounded-md border h-[60vh]">
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
                    </div>
                </TabsContent>
                 <TabsContent value="utilizationReport">
                     <div className="overflow-auto rounded-md border h-[60vh]">
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
                                ) : renderProviderList().length > 0 ? (
                                    renderProviderList().map(provider => {
                                        const data = providerSummaryData[provider.id];
                                        if (!data) return null;
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
                     </div>
                </TabsContent>
                 <TabsContent value="agingReport">
                     <div className="overflow-auto rounded-md border h-[60vh]">
                        <Table>
                             <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead className="text-right">0-30 Days</TableHead>
                                    <TableHead className="text-right">31-60 Days</TableHead>
                                    <TableHead className="text-right">61-90 Days</TableHead>
                                    <TableHead className="text-right">90+ Days</TableHead>
                                    <TableHead className="text-right">Total Overdue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : renderProviderList().length > 0 ? (
                                    renderProviderList().map(provider => {
                                        const data = providerSummaryData[provider.id];
                                        const aging = data?.agingReport;
                                        return (
                                        <TableRow key={provider.id}>
                                            <TableCell>{provider.name}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(aging?.buckets['1-30'] || 0)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(aging?.buckets['31-60'] || 0)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(aging?.buckets['61-90'] || 0)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(aging?.buckets['91+'] || 0)}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">{formatCurrency(aging?.totalOverdue || 0)}</TableCell>
                                        </TableRow>
                                    )})
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                     </div>
                </TabsContent>
                <TabsContent value="borrowerReport">
                     <div className="overflow-auto rounded-md border h-[60vh]">
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
                     </div>
                </TabsContent>
            </Tabs>
        </div>
    );

    