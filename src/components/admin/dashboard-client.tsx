
'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
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
import type { LoanProvider, DashboardData } from '@/lib/types';
import { FileCheck2, Wallet, TrendingUp, DollarSign, Receipt, Banknote, AlertCircle, TrendingDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';


interface LedgerData {
    principal: number;
    interest: number;
    serviceFee: number;
    penalty: number;
}

interface IncomeData {
    interest: number;
    serviceFee: number;
    penalty: number;
}

interface DashboardClientProps {
  dashboardData: {
    providers: LoanProvider[];
    providerData: DashboardData[];
  };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'decimal' }).format(amount) + ' ETB';
};

const LedgerDetailRow = ({ title, value }: { title: string; value: number }) => (
    <div className="flex justify-between items-baseline text-sm py-2 border-b last:border-none">
        <span className="text-muted-foreground">{title}</span>
        <span className="font-mono font-medium">{formatCurrency(value)}</span>
    </div>
);

const DashboardView = ({ data, color }: { data: DashboardData, color: string }) => {
    const {
        totalLoans,
        totalDisbursed,
        repaymentRate,
        atRiskLoans,
        totalUsers,
        loanDisbursementData,
        loanStatusData: rawLoanStatusData,
        recentActivity,
        productOverview,
        initialFund,
        providerFund,
        receivables,
        collections,
        income,
    } = data;
    
    const totalIncome = Object.values(income).reduce((sum, val) => sum + val, 0);

    const loanStatusData = useMemo(() => [
      { name: 'Paid', value: rawLoanStatusData.find(d => d.name === 'Paid')?.value || 0, color: color },
      { name: 'Active (Unpaid)', value: rawLoanStatusData.find(d => d.name === 'Active (Unpaid)')?.value || 0, color: `${color}B3` }, // 70% opacity
      { name: 'Overdue', value: rawLoanStatusData.find(d => d.name === 'Overdue')?.value || 0, color: `${color}66` }, // 40% opacity
    ], [rawLoanStatusData, color]);

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
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Provider Fund (Live)</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(providerFund)}</div>
                    <p className="text-xs text-muted-foreground">Original starting capital: {formatCurrency(initialFund)}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
                    <p className="text-xs text-muted-foreground">All collected fees & interest</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Disbursed</CardTitle>
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalDisbursed)}</div>
                    <p className="text-xs text-muted-foreground">Total amount loaned out</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">At-Risk Loans</CardTitle>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{atRiskLoans}</div>
                    <p className="text-xs text-muted-foreground">Loans currently overdue</p>
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
                            <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} tickFormatter={(value) => `ETB${value}`} />
                            <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '0.5rem' }} />
                            <Legend wrapperStyle={{fontSize: '12px'}}/>
                            <Line type="monotone" dataKey="amount" stroke={color} strokeWidth={2} activeDot={{ r: 8 }} name="Amount"/>
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
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle>Income Statement</CardTitle>
                    <CardDescription>Breakdown of all collected income.</CardDescription>
                </CardHeader>
                <CardContent>
                    <LedgerDetailRow title="Service Fee Income" value={income.serviceFee} />
                    <LedgerDetailRow title="Interest Income" value={income.interest} />
                    <LedgerDetailRow title="Penalty Income" value={income.penalty} />
                    <div className="flex justify-between items-baseline text-sm pt-3 mt-2 border-t-2">
                        <span className="font-bold">Total Income</span>
                        <span className="font-bold text-lg" style={{ color: color }}>{formatCurrency(totalIncome)}</span>
                    </div>
                </CardContent>
            </Card>
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Ledger Balances</CardTitle>
                    <CardDescription>Live view of receivable and collected amounts.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="receivables">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="receivables">Receivables</TabsTrigger>
                            <TabsTrigger value="collections">Collections</TabsTrigger>
                        </TabsList>
                        <TabsContent value="receivables" className="mt-4">
                            <LedgerDetailRow title="Principal Receivable" value={receivables.principal} />
                            <LedgerDetailRow title="Interest Receivable" value={receivables.interest} />
                            <LedgerDetailRow title="Service Fee Receivable" value={receivables.serviceFee} />
                            <LedgerDetailRow title="Penalty Receivable" value={receivables.penalty} />
                        </TabsContent>
                         <TabsContent value="collections" className="mt-4">
                            <LedgerDetailRow title="Principal Received" value={collections.principal} />
                            <LedgerDetailRow title="Interest Received" value={collections.interest} />
                            <LedgerDetailRow title="Service Fee Received" value={collections.serviceFee} />
                            <LedgerDetailRow title="Penalty Received" value={collections.penalty} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-4">
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
                      <TableHead>Borrower</TableHead>
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
                                <Badge variant={loan.status === 'Paid' ? 'secondary' : 'destructive'} style={loan.status === 'Paid' ? { backgroundColor: color, color: 'white' } : {}}>
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
                        <TableRow key={`${product.provider}-${product.name}`}>
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

export function DashboardClient({ dashboardData }: DashboardClientProps) {
  const { currentUser } = useAuth();
  const { providers, providerData } = dashboardData;

  const isSuperAdmin = currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin';
  
  const themeColor = React.useMemo(() => {
    if (isSuperAdmin) {
        return providers.find(p => p.name === 'NIb Bank')?.colorHex || '#fdb913';
    }
    return providers.find(p => p.name === currentUser?.providerName)?.colorHex || '#fdb913';
  }, [currentUser, providers, isSuperAdmin]);
  
  if (!providerData || providerData.length === 0) {
      return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p>Loading dashboard data...</p>
        </div>
      );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <DashboardView data={providerData[0]} color={themeColor} />
      </div>
    );
  }

  // Super admin view with tabs
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <Tabs defaultValue="overall">
            <TabsList>
                <TabsTrigger value="overall">Overall</TabsTrigger>
                {providers.map(provider => (
                    <TabsTrigger key={provider.id} value={provider.id}>{provider.name}</TabsTrigger>
                ))}
            </TabsList>
            
            <TabsContent value="overall" className="mt-4">
                {providerData[0] ? (
                    <DashboardView data={providerData[0]} color={themeColor} />
                ) : <p>Loading overall data...</p>}
            </TabsContent>
            
            {providers.map((provider, index) => {
                 const data = providerData[index + 1];
                 return (
                    <TabsContent key={provider.id} value={provider.id} className="mt-4">
                        {data ? (
                            <DashboardView data={data} color={provider.colorHex || themeColor} />
                        ) : <p>Loading data for {provider.name}...</p>}
                    </TabsContent>
                 )
            })}
        </Tabs>
    </div>
  );
}
