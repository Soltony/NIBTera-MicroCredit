
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, Eye, ArrowRight, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { PendingChangeWithDetails } from './page';
import type { User, LoanProvider } from '@/lib/types';
import { diff as showDiff } from 'json-diff';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import * as XLSX from 'xlsx';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';


const renderFieldValue = (value: any): React.ReactNode => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">[Empty]</span>;
    // show inline summary and full JSON on hover/expand
    return (
      <div>
        <div className="text-sm text-muted-foreground">[{value.length} items]</div>
        <pre className="mt-1 max-h-48 overflow-auto bg-muted p-2 rounded text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
      </div>
    );
  }
  if (typeof value === 'object') {
     // For simple objects like fees, format them
    // If it's a common fee-like object render nicely
    if (value && value.type && value.value !== undefined) {
      return `${value.value}${value.type === 'percentage' ? '%' : ' ETB'}`;
    }
    // Otherwise return a pretty JSON block for clarity
    return <pre className="max-h-48 overflow-auto bg-muted p-2 rounded text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>;
  }
  return String(value);
};


const ChangeDetailsDialog = ({
  change,
  isOpen,
  onClose,
}: {
  change: PendingChangeWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!change) return null;

  const diffResult = useMemo(() => {
    try {
        const { original, updated, created } = JSON.parse(change.payload);

        const formatFieldName = (path: string) => {
            return path
                .replace(/__/g, ' -> ')
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase());
        };

        if (change.changeType === 'UPDATE') {
            const diff = showDiff(original, updated, { full: true, keepUnchangedValues: false });
            const fields = { added: 0, removed: 0, updated: 0, details: [] as any[] };

            const flattenDiff = (obj: any, path: string = ''): any[] => {
                if (!obj || typeof obj !== 'object') return [];
                
                return Object.keys(obj).reduce((acc: any[], key) => {
                    const newPath = path ? `${path}__${key}` : key;
                    const value = obj[key];

                    if (key.endsWith('__added') || key.endsWith('__deleted')) {
                        acc.push({ path: newPath, value });
                    } else if (value && typeof value === 'object' && value.__old !== undefined && value.__new !== undefined) {
                        acc.push({ path: newPath, ...value });
                    } else if (value && typeof value === 'object' && value._t === 'a') {
                        // Handle array diffs
                        acc.push({path: newPath, __old: original[key], __new: updated[key]});
                    }
                    else if (typeof value === 'object' && value !== null) {
                        acc.push(...flattenDiff(value, newPath));
                    }
                    return acc;
                }, []);
            };
            
            const flatDiff = flattenDiff(diff);
            
            flatDiff.forEach(item => {
                 if (item.path.endsWith('__added')) {
                    fields.added++;
                    fields.details.push({ field: formatFieldName(item.path.replace('__added', '')), after: item.value, type: 'added' });
                } else if (item.path.endsWith('__deleted')) {
                    fields.removed++;
                    fields.details.push({ field: formatFieldName(item.path.replace('__deleted', '')), before: item.value, type: 'removed' });
                } else if (item.__old !== undefined || item.__new !== undefined) {
                    fields.updated++;
                    fields.details.push({ field: formatFieldName(item.path), before: item.__old, after: item.__new, type: 'updated' });
                }
            });
            
            return fields;

        } else if (change.changeType === 'CREATE') {
            return {
                added: Object.keys(created).length, removed: 0, updated: 0,
                details: Object.entries(created).map(([key, value]) => ({ field: formatFieldName(key), after: value, type: 'added' }))
            };
        } else if (change.changeType === 'DELETE') {
            return {
                added: 0, removed: Object.keys(original).length, updated: 0,
                details: Object.entries(original).map(([key, value]) => ({ field: formatFieldName(key), before: value, type: 'removed' }))
            };
        }

    } catch (e) {
        console.error("Failed to parse or diff payload:", e);
        return null;
    }
    return null;
  }, [change]);


  // Helper: find a file content in payload (created/updated)
  const getFileContentFromPayload = () => {
    try {
      // Only allow file preview for explicit upload-type changes
      if (!(change.entityType === 'EligibilityList' || change.entityType === 'DataProvisioningUpload')) return null;
      const parsed = JSON.parse(change.payload);
      // created or updated or original may contain fileContent fields
      const candidate = parsed.created || parsed.updated || parsed.original || {};
      // search nested objects for a field named fileContent (base64)
      const searchForFileContent = (obj: any): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        for (const k of Object.keys(obj)) {
          const v = obj[k];
          if (k === 'fileContent' && typeof v === 'string') return v;
          if (typeof v === 'object') {
            const nested = searchForFileContent(v);
            if (nested) return nested;
          }
        }
        return null;
      };
      return searchForFileContent(candidate);
    } catch (e) { return null; }
  };

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewRows, setPreviewRows] = React.useState<any[] | null>(null);
  const [previewHeaders, setPreviewHeaders] = React.useState<string[] | null>(null);

  const openPreviewFromPayload = async () => {
    const fileContent = getFileContentFromPayload();
    if (!fileContent) return;
    try {
      // parse base64 content
      const workbook = XLSX.read(fileContent, { type: 'base64' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      const headers = jsonData.length > 0 ? Object.keys(jsonData[0] as object) : [];
      setPreviewRows(jsonData as any[]);
      setPreviewHeaders(headers);
      setPreviewOpen(true);
    } catch (err) {
      console.error('Failed to parse file content preview:', err);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Change Request Details</DialogTitle>
           <DialogDescription>
            Review the changes submitted for approval.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <Card>
                <CardContent className="pt-6 text-sm space-y-2">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Requested By:</span>
                        <span className="font-medium">{change.createdBy.fullName}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Date:</span>
                        <span className="font-medium">{format(new Date(change.createdAt), 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Entity:</span>
                        <span className="font-medium">{change.entityType} ({change.entityName})</span>
                    </div>
                </CardContent>
            </Card>

            {diffResult && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Summary of Changes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            {diffResult.updated > 0 && `${diffResult.updated} fields updated`}
                            {diffResult.updated > 0 && (diffResult.removed > 0 || diffResult.added > 0) && ' • '}
                            {diffResult.removed > 0 && `${diffResult.removed} fields removed`}
                            {diffResult.removed > 0 && diffResult.added > 0 && ' • '}
                            {diffResult.added > 0 && `${diffResult.added} fields added`}
                        </p>
                    </CardContent>
                </Card>
            )}

            <Collapsible defaultOpen>
                 <CollapsibleTrigger asChild>
                    <Card className="rounded-b-none cursor-pointer group">
                         <CardHeader className="flex-row items-center justify-between">
                            <CardTitle className="text-base">Details</CardTitle>
                            <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CardHeader>
                    </Card>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="border border-t-0 rounded-b-lg p-4 text-sm">
                        <div className="grid grid-cols-3 gap-x-4 mb-2 font-semibold">
                            <div className="col-span-1">Field</div>
                            <div className="col-span-1">Before</div>
                            <div className="col-span-1">After</div>
                        </div>
                        <Separator />
                        {diffResult?.details.map((item, index) => (
                             <div key={index} className="grid grid-cols-3 gap-x-4 py-2 border-b last:border-none">
                                <div className="col-span-1 font-medium capitalize">{item.field}</div>
                                <div className="col-span-1 text-red-600 line-through">
                                    {item.type !== 'added' ? renderFieldValue(item.before) : ''}
                                </div>
                                <div className="col-span-1 text-green-600">
                                    {item.type !== 'removed' ? renderFieldValue(item.after) : ''}
                                </div>
                            </div>
                        ))}
                        {getFileContentFromPayload() && (
                          <div className="grid grid-cols-3 gap-x-4 py-2">
                            <div className="col-span-1 font-medium">Uploaded File</div>
                            <div className="col-span-2 text-right">
                              <Button variant="link" onClick={openPreviewFromPayload} size="sm">View file contents</Button>
                            </div>
                          </div>
                        )}
                         {(!diffResult || diffResult.details.length === 0) && (
                            <p className="text-muted-foreground text-center py-4">No changes to display.</p>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
        {previewOpen && previewRows && (
          <Dialog open={previewOpen} onOpenChange={() => setPreviewOpen(false)}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Preview of uploaded file</DialogTitle>
                <DialogDescription>Parsed rows from the uploaded file attached to this change</DialogDescription>
              </DialogHeader>
              <div className="flex-grow overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      {(previewHeaders || []).map(h => <TableHead key={h}>{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, idx) => (
                      <TableRow key={idx}>
                        {(previewHeaders || []).map(h => <TableCell key={`${idx}-${h}`}>{String((row as any)[h])}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
};


export function ApprovalsClient({
  pendingChanges: initialChanges,
  currentUser,
}: {
  pendingChanges: PendingChangeWithDetails[];
  currentUser: User;
}) {
  const [changes, setChanges] = useState(initialChanges);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [changeToReject, setChangeToReject] = useState<PendingChangeWithDetails | null>(null);
  const [changeToView, setChangeToView] = useState<PendingChangeWithDetails | null>(null);
  const { toast } = useToast();
  const router = useRouter();


  const handleProcessChange = async (changeId: string, approved: boolean, reason?: string) => {
    setProcessingId(changeId);
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId, approved, rejectionReason: reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${approved ? 'approve' : 'reject'} change.`);
      }

      setChanges(prev => prev.filter(c => c.id !== changeId));
      toast({
        title: 'Success',
        description: `Change has been successfully ${approved ? 'approved' : 'rejected'}.`,
      });

      if (approved) {
          router.refresh();
      }

    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
      setChangeToReject(null);
      setRejectionReason('');
    }
  };

  return (
    <>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h2 className="text-3xl font-bold tracking-tight">Pending Approvals</h2>
        <Card>
          <CardHeader>
            <CardTitle>Change Requests</CardTitle>
            <CardDescription>Review and approve or reject pending changes made by other users.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Requested At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : changes.length > 0 ? (
                  changes.map(change => (
                    <TableRow key={change.id}>
                      <TableCell className="font-medium">
                        <div>{change.entityType}</div>
                        <div className="text-sm text-muted-foreground">{change.entityName}</div>
                         {change.providerName && <div className="text-xs text-muted-foreground">({change.providerName})</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={change.changeType === 'DELETE' ? 'destructive' : 'secondary'}>{change.changeType}</Badge>
                      </TableCell>
                      <TableCell>{change.createdBy?.fullName || 'Unknown User'}</TableCell>
                      <TableCell>{formatDistanceToNow(new Date(change.createdAt), { addSuffix: true })}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChangeToView(change)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleProcessChange(change.id, true)}
                          disabled={processingId === change.id || change.createdById === currentUser.id}
                          className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                        >
                          {processingId === change.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setChangeToReject(change)}
                          disabled={processingId === change.id || change.createdById === currentUser.id}
                           className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No pending approvals for you to review.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <Dialog open={!!changeToReject} onOpenChange={() => setChangeToReject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Change</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this change.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g., Incorrect configuration..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeToReject(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => handleProcessChange(changeToReject!.id, false, rejectionReason)}
              disabled={!rejectionReason.trim()}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ChangeDetailsDialog
        change={changeToView}
        isOpen={!!changeToView}
        onClose={() => setChangeToView(null)}
      />
    </>
  );
}
