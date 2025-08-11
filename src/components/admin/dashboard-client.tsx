
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

interface DashboardData {
    totalLoans: number;
    totalDisbursed: number;
    totalPaid: number;
    repaymentRate: number;
    atRiskLoans: number;
    totalUsers: number;
    loanDisbursementData: { name: string; amount: number }[];
    loanStatusData: { name: string; value: number }[];
    recentActivity: { id: string; customer: string; product: string; status: string; amount: number }[];
    productOverview: { name: string; provider: string; active: number; defaulted: number; total: number, defaultRate: number }[];
}

interface DashboardClientProps {
    initialData: DashboardData;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function DashboardClient({ initialData }: DashboardClientProps) {
  const { providers } = useLoanProviders();
  const { currentUser } = useAuth();
  
  const themeColor = React.useMemo(() => {
    if (currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') {
        return providers.find(p => p.name === 'NIb Bank')?.colorHex || '#fdb913';
    }
    return providers.find(p => p.name === currentUser?.providerName)?.colorHex || '#fdb913';
  }, [currentUser, providers]);

  const {
    totalLoans,
    totalDisbursed,
    totalPaid,
    repaymentRate,
    atRiskLoans,
    totalUsers,
    loanDisbursementData,
    loanStatusData: rawLoanStatusData,
    recentActivity,
    productOverview,
  } = initialData;

  const loanStatusData = useMemo(() => [
      { name: 'Paid', value: rawLoanStatusData.find(d => d.name === 'Paid')?.value || 0, color: themeColor },
      { name: 'Active (Unpaid)', value: rawLoanStatusData.find(d => d.name === 'Active (Unpaid)')?.value || 0, color: `${themeColor}B3` }, // 70% opacity
      { name: 'Overdue', value: rawLoanStatusData.find(d => d.name === 'Overdue')?.value || 0, color: `${themeColor}66` }, // 40% opacity
    ], [rawLoanStatusData, themeColor]);


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
                            <Line type="monotone" dataKey="amount" stroke={themeColor} strokeWidth={2} activeDot={{ r: 8 }} name="Amount"/>
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
                            <TableCell>{loan.customer}</TableCell>
                            <TableCell>{loan.product}</TableCell>
                            <TableCell>
                                <Badge variant={loan.status === 'Paid' ? 'secondary' : 'destructive'} style={loan.status === 'Paid' ? { backgroundColor: themeColor, color: 'white' } : {}}>
                                    {loan.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(loan.amount)}</TableCell>
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
