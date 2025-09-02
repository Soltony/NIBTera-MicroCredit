
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
import { LoanProvider } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';


const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};


type LoanReportData = {
    provider: string;
    loanId: string;
    borrowerId: string;
    borrowerName: string;
    principalDisbursed: number;
    principalOutstanding: number;
    interestOutstanding: number;
    serviceFeeOutstanding: number;
    penaltyOutstanding: number;
    totalOutstanding: number;
    status: string;
    daysInArrears: number;
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

    const fetchReportData = useCallback(async (tab: string, currentProviderId: string, currentTimeframe: string) => {
        setIsLoading(true);
        try {
            let endpoint = '';
            // In a real app, you would have different endpoints for each report type
            // For this example, we'll focus on the main loan report.
            switch (tab) {
                case 'providerReport':
                default:
                    endpoint = `/api/reports/loans?providerId=${currentProviderId}&timeframe=${currentTimeframe}`;
                    break;
            }

            const response = await fetch(endpoint);
            if (!response.ok) throw new Error(`Failed to fetch ${tab} data.`);
            const data = await response.json();
            
            if (tab === 'providerReport') {
                setLoansData(data);
            }
            
        } catch (error: any) {
            toast({ title: "Error fetching data", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    // Effect to refetch data when filters change
    useEffect(() => {
        fetchReportData(activeTab, providerId, timeframe);
    }, [activeTab, providerId, timeframe, fetchReportData]);

    
    const handleExcelExport = () => {
        if (loansData.length === 0) {
            toast({ description: "No data to export.", variant: "destructive" });
            return;
        }

        const wb = XLSX.utils.book_new();
        
        const loansWs = XLSX.utils.json_to_sheet(loansData);
        XLSX.utils.book_append_sheet(wb, loansWs, "Provider Loans Report");

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], { type: "application/octet-stream" }), `LoanFlow_Reports_${timeframe}_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

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
                    <Button variant="outline" disabled><FileIcon className="mr-2 h-4 w-4"/>PDF</Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="providerReport">Provider Report</TabsTrigger>
                    <TabsTrigger value="collectionsReport">Collections Report</TabsTrigger>
                    <TabsTrigger value="incomeReport">Income Report</TabsTrigger>
                    <TabsTrigger value="utilizationReport">Fund Utilization</TabsTrigger>
                    <TabsTrigger value="agingReport">Aging Report</TabsTrigger>
                    <TabsTrigger value="borrowerReport">Borrower Performance</TabsTrigger>
                </TabsList>
                <TabsContent value="providerReport" className="space-y-4">
                    <ScrollArea className="h-[60vh] w-full whitespace-nowrap rounded-md border">
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
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="collectionsReport">
                     <div className="h-24 flex items-center justify-center text-muted-foreground">Coming Soon</div>
                </TabsContent>
                 <TabsContent value="incomeReport">
                     <div className="h-24 flex items-center justify-center text-muted-foreground">Coming Soon</div>
                </TabsContent>
                 <TabsContent value="utilizationReport">
                     <div className="h-24 flex items-center justify-center text-muted-foreground">Coming Soon</div>
                </TabsContent>
                 <TabsContent value="agingReport">
                     <div className="h-24 flex items-center justify-center text-muted-foreground">Coming Soon</div>
                </TabsContent>
                <TabsContent value="borrowerReport">
                     <div className="h-24 flex items-center justify-center text-muted-foreground">Coming Soon</div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
