
'use client';

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useAuth } from '@/hooks/use-auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import type { ReportLoan, BorrowerReportInfo } from '@/app/admin/reports/page';
import type { LoanProvider } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '../ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateNplStatus } from '@/actions/npl';


const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'decimal' }).format(amount) + ' ETB';
};

interface ReportsClientProps {
    initialLoans: ReportLoan[];
    providers: LoanProvider[];
    initialBorrowers: BorrowerReportInfo[];
}

function LoansTab({ loans, providers, themeColor }: { loans: ReportLoan[], providers: LoanProvider[], themeColor: string }) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = () => {
        setIsExporting(true);
        const reportData = loans.map(loan => ({
          'Loan ID': loan.id,
          'Provider': loan.providerName,
          'Product': loan.productName,
          'Amount': loan.loanAmount,
          'Service Fee': loan.serviceFee,
          'Interest Rate': loan.interestRate,
          'Penalty Amount': loan.penaltyAmount,
          'Repaid Amount': loan.repaidAmount || 0,
          'Status': loan.repaymentStatus,
          'Due Date': format(new Date(loan.dueDate), 'yyyy-MM-dd'),
          'Payments Count': loan.paymentsCount,
        }));

        if(reportData.length === 0) {
            setIsExporting(false);
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans Report');

        // Auto-size columns
        const cols = Object.keys(reportData[0]);
        const colWidths = cols.map(col => ({
            wch: Math.max(...reportData.map(row => row[col as keyof typeof row]?.toString().length ?? 0), col.length)
        }));
        worksheet['!cols'] = colWidths;
        
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(data, 'LoanFlow_Loans_Report.xlsx');
        setIsExporting(false);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>All Loans</CardTitle>
                    <CardDescription>
                        A comprehensive list of all loans in the system.
                    </CardDescription>
                </div>
                <Button onClick={handleExport} style={{ backgroundColor: themeColor }} className="text-white" disabled={loans.length === 0 || isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Export Loans
                </Button>
            </CardHeader>
            <CardContent>
                {loans.length === 0 ? (
                    <div className="flex justify-center items-center h-64">
                        <p className="text-muted-foreground">No loan data found.</p>
                    </div>
                ) : (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Repaid</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {loans.map((loan) => (
                        <TableRow key={loan.id}>
                        <TableCell>{loan.providerName}</TableCell>
                        <TableCell>{loan.productName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(loan.loanAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(loan.repaidAmount || 0)}</TableCell>
                        <TableCell>
                            <Badge variant={loan.repaymentStatus === 'Paid' ? 'secondary' : 'destructive'} style={loan.repaymentStatus === 'Paid' ? { backgroundColor: themeColor, color: 'white' } : {}}>
                            {loan.repaymentStatus}
                            </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(loan.dueDate), 'yyyy-MM-dd')}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                )}
            </CardContent>
        </Card>
    );
}

function BorrowersTab({ initialBorrowers, themeColor }: { initialBorrowers: BorrowerReportInfo[], themeColor: string }) {
    const [borrowers, setBorrowers] = useState(initialBorrowers);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleUpdateStatus = async (borrowerId: string, newStatus: string) => {
        try {
            const response = await fetch('/api/borrowers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ borrowerId, status: newStatus }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update status');
            }
            const updatedBorrower = await response.json();
            setBorrowers(prev => prev.map(b => b.id === updatedBorrower.id ? { ...b, status: updatedBorrower.status } : b));
            toast({ title: 'Status Updated', description: `Borrower status changed to ${newStatus}` });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const runNplCheck = async () => {
        setIsLoading(true);
        try {
            const result = await updateNplStatus();
            if (result.success) {
                toast({ title: 'NPL Check Complete', description: result.message });
                // We might need to refetch the borrowers list here to see the changes immediately
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ title: 'Error Running NPL Check', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Borrower Accounts</CardTitle>
                    <CardDescription>
                        View and manage borrower accounts and their NPL status.
                    </CardDescription>
                </div>
                <Button onClick={runNplCheck} variant="outline" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Run NPL Check
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Borrower Name</TableHead>
                            <TableHead>Borrower ID</TableHead>
                            <TableHead>Active Loans</TableHead>
                            <TableHead>Overdue Loans</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {borrowers.map((borrower) => (
                            <TableRow key={borrower.id}>
                                <TableCell className="font-medium">{borrower.name}</TableCell>
                                <TableCell>{borrower.id}</TableCell>
                                <TableCell>{borrower.activeLoans}</TableCell>
                                <TableCell>{borrower.overdueLoans}</TableCell>
                                <TableCell>
                                    <Badge variant={borrower.status !== 'NPL' ? 'secondary' : 'destructive'} style={borrower.status === 'NPL' ? {} : {backgroundColor: themeColor, color: 'white'}}>
                                        {borrower.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                     <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleUpdateStatus(borrower.id, 'Active')} disabled={borrower.status === 'Active'}>
                                                Mark as Active
                                            </DropdownMenuItem>
                                             <DropdownMenuItem onClick={() => handleUpdateStatus(borrower.id, 'NPL')} disabled={borrower.status === 'NPL'}>
                                                Mark as NPL
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}


export function ReportsClient({ initialLoans, providers, initialBorrowers }: ReportsClientProps) {
  const { currentUser } = useAuth();

  const themeColor = useMemo(() => {
    if (currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') {
        return providers.find(p => p.name === 'NIb Bank')?.colorHex || '#fdb913';
    }
    return providers.find(p => p.name === currentUser?.providerName)?.colorHex || '#fdb913';
  }, [currentUser, providers]);


  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
      </div>
      <Tabs defaultValue="loans">
        <TabsList>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="borrowers">Borrowers</TabsTrigger>
        </TabsList>
        <TabsContent value="loans" className="mt-4">
             <LoansTab loans={initialLoans} providers={providers} themeColor={themeColor} />
        </TabsContent>
        <TabsContent value="borrowers" className="mt-4">
            <BorrowersTab initialBorrowers={initialBorrowers} themeColor={themeColor} />
        </TabsContent>
      </Tabs>
    </div>
  );
}