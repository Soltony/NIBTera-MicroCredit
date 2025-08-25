
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Logo } from '../icons';
import type { LoanProvider } from '@/lib/types';
import Link from 'next/link';

interface CustomerData {
  id: string;
  allData: Record<string, any>;
  loanHistory: { totalLoans: number; onTimeRepayments: number };
}

interface EligibilityCheckerClientProps {
  customers: CustomerData[];
  providers: LoanProvider[];
}

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return 'N/A';
    const num = Number(amount);
    if (isNaN(num)) return String(amount);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const formatValue = (key: string, value: any) => {
    if (value === null || value === undefined) return 'N/A';
    if (key.toLowerCase().includes('income') || key.toLowerCase().includes('salary') || key.toLowerCase().includes('amount')) {
        return formatCurrency(value);
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
};

// Function to create a human-readable label from a key
const formatHeader = (key: string) => {
    return key
        .replace(/([A-Z])/g, ' $1') // insert a space before all caps
        .replace(/_/g, ' ') // replace underscores with spaces
        .replace(/\b\w/g, char => char.toUpperCase()); // capitalize the first letter of each word
};


export function EligibilityCheckerClient({ customers, providers }: EligibilityCheckerClientProps) {
  const router = useRouter();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const handleCheckEligibility = () => {
    if (selectedCustomerId) {
        router.push(`/loan?customerId=${selectedCustomerId}`);
    } else {
      alert('Please select a customer first.');
    }
  };
  
  const allColumns = useMemo(() => {
    const columnSet = new Set<string>();
    customers.forEach(c => {
        Object.keys(c.allData).forEach(key => columnSet.add(key));
    });
    // Define a preferred order
    const preferredOrder = ['id', 'age', 'gender', 'educationLevel', 'monthlyIncome', 'salary'];
    const sortedColumns = Array.from(columnSet).sort((a, b) => {
        const indexA = preferredOrder.indexOf(a);
        const indexB = preferredOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });
    return sortedColumns;
  }, [customers]);

  const nibBankColor = '#fdb913';

  return (
    <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-40 w-full border-b" style={{ backgroundColor: nibBankColor }}>
            <div className="container flex h-16 items-center">
                <div className="mr-4 flex items-center">
                    <Logo className="h-6 w-6 mr-4" />
                    <h1 className="text-lg font-semibold tracking-tight text-primary-foreground">Check Eligibility</h1>
                </div>
            </div>
        </header>
        <main className="flex-1 py-8 md:py-12">
            <div className="container max-w-full">
                 <Card>
                    <CardHeader>
                        <CardTitle>Select a Customer Profile</CardTitle>
                        <CardDescription>
                            Choose one of the customer profiles from your uploaded data to check their loan eligibility.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {customers.length > 0 ? (
                            <RadioGroup value={selectedCustomerId || ''} onValueChange={setSelectedCustomerId}>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px]"></TableHead>
                                                {allColumns.map(key => (
                                                    <TableHead key={key} className={key.toLowerCase().includes('income') || key.toLowerCase().includes('salary') ? 'text-right' : ''}>{formatHeader(key)}</TableHead>
                                                ))}
                                                <TableHead>Loan History</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {customers.map((customer) => (
                                                <TableRow key={customer.id}>
                                                    <TableCell>
                                                        <RadioGroupItem value={customer.id} id={`customer-${customer.id}`} />
                                                    </TableCell>
                                                    {allColumns.map(key => (
                                                        <TableCell key={key} className={key.toLowerCase().includes('income') || key.toLowerCase().includes('salary') ? 'text-right' : ''}>
                                                            {key === 'id' ? 
                                                                <Label htmlFor={`customer-${customer.id}`} className="font-medium">User #{customer.id}</Label>
                                                                : formatValue(key, customer.allData[key])
                                                            }
                                                        </TableCell>
                                                    ))}
                                                    <TableCell>{`${customer.loanHistory.onTimeRepayments} / ${customer.loanHistory.totalLoans} on-time`}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </RadioGroup>
                        ) : (
                             <div className="flex flex-col items-center justify-center h-64 text-center">
                                <p className="text-muted-foreground">No customer data found.</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Please <Link href="/admin/login" className="underline font-medium" style={{color: nibBankColor}}>login to the admin dashboard</Link> to upload customer data.
                                </p>
                             </div>
                        )}
                    </CardContent>
                </Card>
                {customers.length > 0 && (
                    <div className="flex justify-end mt-6">
                        <Button 
                            onClick={handleCheckEligibility}
                            disabled={!selectedCustomerId}
                            size="lg"
                            style={{ backgroundColor: nibBankColor }}
                            className="text-white"
                        >
                            Check Eligibility
                        </Button>
                    </div>
                )}
            </div>
        </main>
    </div>
  );
}
