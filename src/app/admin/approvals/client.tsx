
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, Eye, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
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


const ChangeDetailsDialog = ({
  change,
  isOpen,
  onClose,
  allProviders,
}: {
  change: PendingChangeWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  allProviders: LoanProvider[];
}) => {
  if (!change) return null;

  const renderReadableDiff = (payload: string) => {
    try {
      const data = JSON.parse(payload);
      const { original, updated, created } = data;

      let content;

      if (change.changeType === 'CREATE') {
        content = created;
      } else if (change.changeType === 'DELETE') {
        content = original;
      } else { // UPDATE
        content = showDiff(original, updated);
      }

      if (!content) {
        return <p className="text-sm text-muted-foreground">No payload data to display.</p>;
      }
      
       // Special handling for columns to parse the inner JSON string
      if (content.columns && typeof content.columns === 'string') {
          try {
              content.columns = JSON.parse(content.columns);
          } catch (e) {
              // ignore if it fails
          }
      }
      if (content.columns?.__new && typeof content.columns.__new === 'string') {
           try {
              content.columns.__new = JSON.parse(content.columns.__new);
          } catch (e) {
              // ignore if it fails
          }
      }
      if (content.columns?.__old && typeof content.columns.__old === 'string') {
           try {
              content.columns.__old = JSON.parse(content.columns.__old);
          } catch (e) {
              // ignore if it fails
          }
      }


      return (
        <pre className="text-sm bg-muted/50 p-4 rounded-md overflow-x-auto">
          <code>{JSON.stringify(content, null, 2)}</code>
        </pre>
      );

    } catch (e) {
      console.error("Failed to parse or diff payload:", e);
      return <p className="text-destructive">Could not parse or display change details.</p>;
    }
  };
  
  const getProviderName = (providerId: string | null | undefined): string => {
      if (!providerId) return 'N/A';
      return allProviders.find(p => p.id === providerId)?.name || providerId;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Change Details</DialogTitle>
          <DialogDescription>
            Review the changes submitted for approval.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="font-semibold">Entity</div><div>{change.entityType}</div>
                <div className="font-semibold">Name</div><div>{change.entityName}</div>
                 {change.providerName && (
                    <>
                        <div className="font-semibold">Provider</div><div>{change.providerName}</div>
                    </>
                )}
                <div className="font-semibold">Change Type</div><div><Badge>{change.changeType}</Badge></div>
            </div>
             <div className="space-y-1 pt-4">
                 <h4 className="font-semibold text-sm">Payload Changes:</h4>
                 {renderReadableDiff(change.payload)}
            </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export function ApprovalsClient({
  pendingChanges: initialChanges,
  currentUser,
  allProviders,
}: {
  pendingChanges: PendingChangeWithDetails[];
  currentUser: User;
  allProviders: LoanProvider[];
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
        allProviders={allProviders}
      />
    </>
  );
}
