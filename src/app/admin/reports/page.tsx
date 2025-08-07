
'use client';

import React from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useLoanHistory } from '@/hooks/use-loan-history';
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
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import type { LoanDetails } from '@/lib/types';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function AdminReportsPage() {
  const { loans } = useLoanHistory();

  const handleExport = () => {
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
      'Payments Count': loan.payments.length,
    }));

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans Report');

    // Auto-size columns
    const cols = Object.keys(reportData[0]);
    const colWidths = cols.map(col => ({
        wch: Math.max(...reportData.map(row => row[col as keyof typeof row].toString().length), col.length)
    }));
    worksheet['!cols'] = colWidths;
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, 'LoanFlow_Reports.xlsx');
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Loan Reports</h2>
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Loans</CardTitle>
          <CardDescription>A comprehensive list of all loans in the system.</CardDescription>
        </CardHeader>
        <CardContent>
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
                    <Badge variant={loan.repaymentStatus === 'Paid' ? 'secondary' : 'destructive'}>
                      {loan.repaymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(loan.dueDate), 'yyyy-MM-dd')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
