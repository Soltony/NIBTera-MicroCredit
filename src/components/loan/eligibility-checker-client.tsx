
'use client';

import React, { useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { LoanProvider } from '@/lib/types';

interface CustomerData {
  id: string;
  age: number;
  monthlyIncome: number;
  gender: string;
  educationLevel: string;
  loanHistory: { totalLoans: number; onTimeRepayments: number };
}

interface EligibilityCheckerClientProps {
  customers: CustomerData[];
  providers: LoanProvider[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};


export function EligibilityCheckerClient({ customers, providers }: EligibilityCheckerClientProps) {
  const router = useRouter();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(providers[0]?.id || null);
  
  const handleCheckEligibility = () => {
    if (selectedCustomerId && selectedProviderId) {
        const provider = providers.find(p => p.id === selectedProviderId);
        if (provider && provider.products.length > 0) {
            // For simplicity, we just use the first product of the provider.
            // In a real app, you might let the user choose a product first.
            const productId = provider.products[0].id;
            router.push(`/check-eligibility?customerId=${selectedCustomerId}&providerId=${selectedProviderId}&productId=${productId}`);
        } else {
            alert('This provider has no products available to check eligibility for.');
        }
    } else {
      alert('Please select a customer and a provider first.');
    }
  };

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
            <div className="container max-w-4xl">
                 <Card>
                    <CardHeader>
                        <CardTitle>Select a Customer Profile and Provider</CardTitle>
                        <CardDescription>
                            Choose one of the mock customer profiles and a provider to check their loan eligibility.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className='mb-6'>
                            <Label>Select Provider</Label>
                            <Select value={selectedProviderId || ''} onValueChange={setSelectedProviderId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    {providers.map(provider => (
                                        <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <RadioGroup value={selectedCustomerId || ''} onValueChange={setSelectedCustomerId}>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]"></TableHead>
                                        <TableHead>Customer ID</TableHead>
                                        <TableHead>Age</TableHead>
                                        <TableHead>Gender</TableHead>
                                        <TableHead>Education</TableHead>
                                        <TableHead>Loan History</TableHead>
                                        <TableHead className="text-right">Monthly Income</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customers.map((customer) => (
                                        <TableRow key={customer.id}>
                                            <TableCell>
                                                <RadioGroupItem value={customer.id} id={`customer-${customer.id}`} />
                                            </TableCell>
                                            <TableCell>
                                                <Label htmlFor={`customer-${customer.id}`} className="font-medium">User #{customer.id}</Label>
                                            </TableCell>
                                            <TableCell>{customer.age}</TableCell>
                                            <TableCell>{customer.gender}</TableCell>
                                            <TableCell>{customer.educationLevel}</TableCell>
                                            <TableCell>{`${customer.loanHistory.onTimeRepayments} / ${customer.loanHistory.totalLoans} loans paid on time`}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(customer.monthlyIncome)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </RadioGroup>
                    </CardContent>
                </Card>
                <div className="flex justify-end mt-6">
                    <Button 
                        onClick={handleCheckEligibility}
                        disabled={!selectedCustomerId || !selectedProviderId}
                        size="lg"
                        style={{ backgroundColor: nibBankColor }}
                        className="text-white"
                    >
                        Check Eligibility
                    </Button>
                </div>
            </div>
        </main>
    </div>
  );
}
