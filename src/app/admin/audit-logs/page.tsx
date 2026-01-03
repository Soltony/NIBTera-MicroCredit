
'use client';

import React, { useState, useEffect } from 'react';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronLeft, ChevronRight, FileJson } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface AuditLog {
    id: string;
    actorId: string;
    actor?: { id: string; fullName: string; email: string } | null;
    action: string;
    entity: string | null;
    entityId: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: string;
    details?: string | null;
}

// (details page moved to its own route)

const ITEMS_PER_PAGE = 20;

export default function AuditLogsPage() {
    useRequirePermission('audit-logs');
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const router = useRouter();
    const { toast } = useToast();

    const exportLogs = async (exportFormat: 'csv' | 'json') => {
        if (!fromDate || !toDate) {
            toast({ title: 'Missing dates', description: 'Please select From and To dates.', variant: 'destructive' });
            return;
        }

        const url = `/api/audit-logs/export?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&tz=${encodeURIComponent('Africa/Nairobi')}&format=${encodeURIComponent(exportFormat)}`;
        // Trigger browser download
        window.location.href = url;
    };

    useEffect(() => {
        const fetchLogs = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/audit-logs?page=${page}&limit=${ITEMS_PER_PAGE}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch audit logs.');
                }
                const data = await response.json();
                setLogs(data.logs);
                setTotalPages(data.totalPages);
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

        fetchLogs();
    }, [page, toast]);

    // change request payload fetching moved to the dedicated detail page
    
    const getActionBadgeClass = (action: string): string => {
        if (action.includes('SUCCESS') || action.includes('CREATE')) return 'bg-green-600 text-white';
        if (action.includes('FAILURE') || action.includes('DELETE')) return 'bg-red-600 text-white';
        if (action.includes('UPDATE')) return 'bg-blue-600 text-white';
        if (action.includes('LOGIN')) return 'bg-yellow-500 text-black';
        return 'bg-gray-500 text-white';
    };


    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
                        <p className="text-muted-foreground">
                            A chronological record of system activities.
                        </p>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">From</span>
                            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[160px]" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">To</span>
                            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[160px]" />
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => void exportLogs('csv')}
                            disabled={!fromDate || !toDate}
                        >
                            Export CSV
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => void exportLogs('json')}
                            disabled={!fromDate || !toDate}
                        >
                            Export JSON
                        </Button>
                    </div>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Activity History</CardTitle>
                        <CardDescription>
                            This log contains all significant actions performed by users and the system.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Actor</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Entity</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>IP Address</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length > 0 ? (
                                    logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{log.actor?.fullName || 'Unknown user'}</span>
                                                    <span className="text-xs text-muted-foreground font-mono break-all">{log.actor?.email || log.actorId}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={getActionBadgeClass(log.action)}
                                                >
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {log.entity ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{log.entity}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">{log.entityId}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                                            <TableCell className="font-mono">{log.ipAddress || 'N/A'}</TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => router.push(`/admin/audit-logs/${log.id}`)}
                                                    className="h-8 w-8"
                                                >
                                                    <FileJson className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No audit logs found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter>
                        <div className="flex items-center justify-end w-full space-x-2">
                             <span className="text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>
            {/* navigation to full detail page */}
        </>
    );
}
