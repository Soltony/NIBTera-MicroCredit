
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
import { ScrollArea } from '../ui/scroll-area';

interface CustomerData {
  id: string;
  [key: string]: any;
}

interface EligibilityCheckerClientProps {
  customers: CustomerData[];
  providers: LoanProvider[];
}

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount));
};

const formatValue = (key: string, value: any) => {
    if (value === null || value === undefined) return 'N/A';
    const keyLower = key.toLowerCase();
    if (keyLower.includes('income') || keyLower.includes('salary') || keyLower.includes('amount')) {
        return formatCurrency(value);
    }
    if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
    }
    return String(value);
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
    if (customers.length === 0) return [];
    const columnSet = new Set<string>();
    customers.forEach(c => {
        if (!c) return;
        Object.keys(c).forEach(key => columnSet.add(key));
    });
    
    // Make sure 'id' is first, then sort the rest
    const sortedColumns = Array.from(columnSet).filter(c => c !== 'id');
    sortedColumns.sort((a,b) => a.localeCompare(b));
    return ['id', ...sortedColumns];
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
            <div className="container max-w-7xl">
                 <Card>
                    <CardHeader>
                        <CardTitle>Select a Customer Profile</CardTitle>
                        <CardDescription>
                            Choose one of the customer profiles from your uploaded data to check their loan eligibility.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RadioGroup value={selectedCustomerId || ''} onValueChange={setSelectedCustomerId}>
                             <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                                 <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px] sticky left-0 bg-card z-10"></TableHead>
                                            {allColumns.map(header => (
                                                <TableHead 
                                                    key={header} 
                                                    className={header === 'id' ? "sticky left-[50px] bg-card z-10 capitalize" : "capitalize"}
                                                >
                                                    {header.replace(/_/g, ' ')}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customers.map((customer) => (
                                            <TableRow key={customer.id}>
                                                <TableCell className="sticky left-0 bg-card z-10">
                                                    <RadioGroupItem value={customer.id} id={`customer-${customer.id}`} />
                                                </TableCell>
                                                {allColumns.map(header => (
                                                     <TableCell 
                                                        key={`${customer.id}-${header}`}
                                                        className={header === 'id' ? "sticky left-[50px] bg-card z-10 font-medium" : ""}
                                                     >
                                                        {formatValue(header, customer[header])}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {customers.length === 0 && (
                                    <div className="flex items-center justify-center h-48">
                                        <p className="text-muted-foreground">No customer data found. Please upload a file in the Admin Dashboard.</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </RadioGroup>
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
