
'use client';

import React, { useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { useLoanHistory } from '@/hooks/use-loan-history';
import { useLoanProviders } from '@/hooks/use-loan-providers';
import { useAuth } from '@/hooks/use-auth';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { subDays, format, isAfter } from 'date-fns';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function AdminDashboard() {
  const { loans: allLoans } = useLoanHistory();
  const { providers } = useLoanProviders();
  const { currentUser } = useAuth();
  const nibBankColor = providers.find(p => p.name === 'NIb Bank')?.colorHex;

  const loans = useMemo(() => {
    if (currentUser?.role === 'Loan Provider') {
      return allLoans.filter(loan => loan.providerName === currentUser.providerName);
    }
    return allLoans;
  }, [allLoans, currentUser]);

  const {
    totalLoans,
    totalDisbursed,
    totalPaid,
    repaymentRate,
    atRiskLoans,
    totalUsers,
    loanDisbursementData,
    loanStatusData,
    recentActivity,
    productOverview,
  } = useMemo(() => {
    const totalLoans = loans.length;
    const totalDisbursed = loans.reduce((acc, loan) => acc + loan.loanAmount, 0);
    const paidLoans = loans.filter(loan => loan.repaymentStatus === 'Paid');
    const totalPaid = paidLoans.reduce((acc, loan) => acc + (loan.repaidAmount || loan.loanAmount), 0);
    const repaidOnTime = paidLoans.filter(loan => {
        const payment = loan.payments?.[0];
        if (!payment) return false;
        return !isAfter(new Date(payment.date), new Date(loan.dueDate));
    }).length;
    const repaymentRate = paidLoans.length > 0 ? (repaidOnTime / paidLoans.length) * 100 : 0;
    const atRiskLoans = loans.filter(
      (loan) => loan.repaymentStatus === 'Unpaid' && new Date() > new Date(loan.dueDate)
    ).length;
    const totalUsers = new Set(loans.map((loan) => loan.providerName)).size;

    // Data for Loan Disbursement Chart
    const disbursementData: { [key: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const formattedDate = format(date, 'MMM d');
      disbursementData[formattedDate] = 0;
    }
    loans.forEach((loan) => {
      // For mock data, we need a creation date. We'll estimate it from due date.
      const creationDate = subDays(new Date(loan.dueDate), 30);
      const formattedDate = format(creationDate, 'MMM d');
      if (formattedDate in disbursementData) {
        disbursementData[formattedDate] += loan.loanAmount;
      }
    });
    const loanDisbursementData = Object.entries(disbursementData).map(([name, amount]) => ({ name, amount }));

    // Data for Loan Status Distribution Chart
    const overdueCount = loans.filter(loan => loan.repaymentStatus === 'Unpaid' && isAfter(new Date(), new Date(loan.dueDate))).length;
    const activeUnpaidCount = loans.filter(loan => loan.repaymentStatus === 'Unpaid' && !isAfter(new Date(), new Date(loan.dueDate))).length;
    const paidCount = loans.filter(loan => loan.repaymentStatus === 'Paid').length;
    const loanStatusData = [
      { name: 'Paid', value: paidCount, color: '#fdb913' },
      { name: 'Active (Unpaid)', value: activeUnpaidCount, color: '#fde08a' },
      { name: 'Overdue', value: overdueCount, color: '#fef3c7' },
    ];
    
    // Data for Recent Loan Activity Table
    const recentActivity = [...loans]
      .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
      .slice(0, 5);

    // Data for Loan Products Overview
    const products: { [key: string]: { provider: string, active: number, defaulted: number, total: number } } = {};
    loans.forEach(loan => {
        if (!products[loan.productName]) {
            products[loan.productName] = { provider: loan.providerName, active: 0, defaulted: 0, total: 0 };
        }
        products[loan.productName].total++;
        if (loan.repaymentStatus === 'Unpaid') {
            products[loan.productName].active++;
            if (new Date() > new Date(loan.dueDate)) {
                products[loan.productName].defaulted++;
            }
        }
    });
    const productOverview = Object.entries(products).map(([name, data]) => ({
        name,
        ...data,
        defaultRate: data.total > 0 ? (data.defaulted / data.total) * 100 : 0
    }));


    return {
      totalLoans,
      totalDisbursed,
      totalPaid,
      repaymentRate,
      atRiskLoans,
      totalUsers,
      loanDisbursementData,
      loanStatusData,
      recentActivity,
      productOverview,
    };
  }, [loans]);

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }: any) => {
    if (value === 0) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };


  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalLoans}</div>
                    <p className="text-xs text-muted-foreground">All loans issued</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Disbursed</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalDisbursed)}</div>
                    <p className="text-xs text-muted-foreground">Total amount loaned</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalPaid)}</div>
                    <p className="text-xs text-muted-foreground">Total amount repaid</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Repayment Rate</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{repaymentRate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">Loans repaid on time</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">At-Risk Loans</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{atRiskLoans}</div>
                    <p className="text-xs text-muted-foreground">Loans currently overdue</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalUsers}</div>
                    <p className="text-xs text-muted-foreground">All users on the platform</p>
                </CardContent>
            </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
                <CardHeader>
                    <CardTitle>Loan Disbursement Over Time</CardTitle>
                    <CardDescription>Last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={loanDisbursementData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{fontSize: 12}} tickLine={false} axisLine={false}/>
                            <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                            <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '0.5rem' }} />
                            <Legend wrapperStyle={{fontSize: '12px'}}/>
                            <Line type="monotone" dataKey="amount" stroke={nibBankColor} strokeWidth={2} activeDot={{ r: 8 }} name="Amount"/>
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>Loan Status Distribution</CardTitle>
                    <CardDescription>A breakdown of all loans by their current status.</CardDescription>
                </CardHeader>
                <CardContent>
                   <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                        <Pie
                            data={loanStatusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderCustomizedLabel}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {loanStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                         <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}}/>
                        <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '0.5rem' }}/>
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Recent Loan Activity</CardTitle>
                <CardDescription>
                  A log of the most recent loan applications.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivity.map((loan) => (
                        <TableRow key={loan.id}>
                            <TableCell>{loan.providerName}</TableCell>
                            <TableCell>{loan.productName}</TableCell>
                            <TableCell>
                                <Badge variant={loan.repaymentStatus === 'Paid' ? 'secondary' : 'destructive'} style={loan.repaymentStatus === 'Paid' ? { backgroundColor: nibBankColor, color: 'white' } : {}}>
                                    {loan.repaymentStatus}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(loan.loanAmount)}</TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Loan Products Overview</CardTitle>
                <CardDescription>
                  A summary of all available loan products.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Active Loans</TableHead>
                      <TableHead className="text-right">Default Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productOverview.map((product) => (
                        <TableRow key={product.name}>
                            <TableCell>{product.name}</TableCell>
                            <TableCell>{product.provider}</TableCell>
                            <TableCell>{product.active}</TableCell>
                            <TableCell className="text-right">{product.defaultRate.toFixed(1)}%</TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
        </div>
    </div>
  );
}
