
'use client';

import React, { useState, useEffect } from 'react';
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
import { Loader2, MoreHorizontal, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { LoanApplication, LoanProvider } from '@/lib/types';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'decimal' }).format(amount) + ' ETB';
};

export default function ApplicationsPage() {
    const [applications, setApplications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchApplications = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/admin/applications');
                if (!response.ok) {
                    throw new Error('Failed to fetch applications.');
                }
                const data = await response.json();
                setApplications(data);
            } catch (error: any) {
                toast({
                    title: 'Error',
                    description: error.message,
                    variant: 'destructive',
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchApplications();
    }, [toast]);
    
    // Placeholder functions for actions
    const viewDocuments = (applicationId: string) => {
        console.log('Viewing documents for', applicationId);
    };

    const approveApplication = (applicationId: string) => {
        console.log('Approving', applicationId);
    };

    const rejectApplication = (applicationId: string) => {
        console.log('Rejecting', applicationId);
    };

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Loan Applications</h2>
            <p className="text-muted-foreground">
                Review and process SME loan applications pending approval.
            </p>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Review</CardTitle>
                    <CardDescription>The following applications have all documents uploaded and are ready for a decision.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date Submitted</TableHead>
                                <TableHead>Borrower</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Provider</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                    </TableCell>
                                </TableRow>
                            ) : applications.length > 0 ? (
                                applications.map((app) => (
                                    <TableRow key={app.id}>
                                        <TableCell>{format(new Date(app.updatedAt), 'yyyy-MM-dd')}</TableCell>
                                        <TableCell>{app.borrowerName}</TableCell>
                                        <TableCell>{app.product.name}</TableCell>
                                        <TableCell>{app.product.provider.name}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(app.loanAmount)}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{app.status.replace('_', ' ')}</Badge>
                                        </TableCell>
                                        <TableCell>
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => viewDocuments(app.id)}>
                                                        <FileText className="mr-2 h-4 w-4"/>
                                                        View Documents
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => approveApplication(app.id)}>
                                                        <CheckCircle className="mr-2 h-4 w-4 text-green-600"/>
                                                        Approve
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600" onClick={() => rejectApplication(app.id)}>
                                                        <XCircle className="mr-2 h-4 w-4"/>
                                                        Reject
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No applications are currently pending review.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
