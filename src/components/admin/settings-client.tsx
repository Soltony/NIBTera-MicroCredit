

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Trash2, Loader2, Edit, ChevronDown, Settings2, Save, FilePlus2, Upload, FileClock, Pencil, Link as LinkIcon, ChevronRight, ChevronLeft } from 'lucide-react';
import type { LoanProvider, LoanProduct, FeeRule, PenaltyRule, DataProvisioningConfig, LoanAmountTier, TermsAndConditions, DataColumn, DataProvisioningUpload, Tax } from '@/lib/types';
import { AddProviderDialog } from '@/components/loan/add-provider-dialog';
import { AddProductDialog } from '@/components/loan/add-product-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog as UIDialog,
  DialogContent as UIDialogContent,
  DialogHeader as UIDialogHeader,
  DialogTitle as UIDialogTitle,
  DialogFooter as UIDialogFooter,
  DialogClose as UIDialogClose,
  DialogDescription as UIDialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { produce } from 'immer';
import { IconDisplay } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';
import { Checkbox } from '../ui/checkbox';
import Link from 'next/link';


const ProductSettingsForm = ({ provider, product, providerColor, onSave, onDelete, onUpdate, allDataConfigs }: {
    provider: LoanProvider;
    product: LoanProduct;
    providerColor?: string;
    onSave: (product: LoanProduct) => void;
    onDelete: () => void;
    onUpdate: (updatedProduct: Partial<LoanProduct>) => void;
    allDataConfigs: DataProvisioningConfig[];
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const [viewingUpload, setViewingUpload] = useState<DataProvisioningUpload | null>(null);
    
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const formData = useMemo(() => {
        return {
            ...product,
            serviceFee: typeof product.serviceFee === 'string' ? JSON.parse(product.serviceFee) : product.serviceFee,
            dailyFee: typeof product.dailyFee === 'string' ? JSON.parse(product.dailyFee) : product.dailyFee,
            penaltyRules: typeof product.penaltyRules === 'string' ? JSON.parse(product.penaltyRules) : product.penaltyRules,
            eligibilityFilter: product.eligibilityFilter
        };
    }, [product]);
    
    const linkedConfig = useMemo(() => {
        if (!product.dataProvisioningConfigId) return null;
        return allDataConfigs.find(c => c.id === product.dataProvisioningConfigId);
    }, [product.dataProvisioningConfigId, allDataConfigs]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        onUpdate({ [name]: value === '' ? null : value });
    };

    const handleSwitchChange = (name: keyof LoanProduct, checked: boolean) => {
        if (name === 'status') {
            handleStatusChange(checked);
        } else {
            onUpdate({ [name]: checked });
        }
    }

    const handleStatusChange = async (checked: boolean) => {
        const newStatus = checked ? 'Active' : 'Disabled';
        // Optimistically update the UI
        onUpdate({ status: newStatus }); 
        
        try {
            const response = await fetch('/api/settings/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: product.id, status: newStatus })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update status.');
            }
            
            toast({
                title: 'Status Updated',
                description: `${product.name} has been set to ${newStatus}.`
            });
            // The onUpdate call above already updated the state, so no need to do it again on success.

        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
            // Revert UI on failure
            onUpdate({ status: product.status });
        }
    };
    
    const handleFilterFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !product.dataProvisioningConfigId) return;

        setIsUploading(true);
        try {
            const fileContentBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = error => reject(error);
            });

            // Create a temporary upload object for the UI
            const tempUpload: DataProvisioningUpload = {
                id: `temp-${Date.now()}`,
                configId: product.dataProvisioningConfigId,
                fileName: file.name,
                rowCount: 0, // Placeholder
                uploadedAt: new Date().toISOString(),
                uploadedBy: 'you',
                status: 'PENDING_APPROVAL', // This indicates it's new and not saved
                // Store file content temporarily for submission
                fileContent: fileContentBase64
            };
            
            onUpdate({ eligibilityUpload: tempUpload });

            toast({ title: "File Ready for Submission", description: `"${file.name}" is ready. Click "Submit Eligibility for Approval" to save.` });

        } catch (error: any) {
            toast({ title: "Error reading file", description: error.message, variant: 'destructive'});
        } finally {
            setIsUploading(false);
            if (event.target) event.target.value = '';
        }
    };

    const handleEligibilitySubmitForApproval = async () => {
        if (!product.eligibilityUpload || !('fileContent' in product.eligibilityUpload)) {
            toast({ title: 'No File to Submit', description: 'Please upload a new eligibility file first.', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                created: {
                    productId: product.id,
                    configId: product.dataProvisioningConfigId,
                    fileName: product.eligibilityUpload.fileName,
                    fileContent: (product.eligibilityUpload as any).fileContent,
                }
            };
             const response = await fetch('/api/settings/pending-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entityType: 'EligibilityList',
                    entityId: product.id,
                    changeType: 'UPDATE', // Using UPDATE to signify changing the product's list
                    payload: JSON.stringify(payload),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to submit eligibility list for approval.');
            }
            
            onUpdate({ eligibilityUpload: { ...product.eligibilityUpload, status: 'PENDING_APPROVAL' }});

            toast({ title: "Submitted for Approval", description: "The new eligibility list is pending review." });

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }


    const submitForApproval = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
             const productToSave = {
                ...product,
                minLoan: parseFloat(String(formData.minLoan)) || 0,
                maxLoan: parseFloat(String(formData.maxLoan)) || 0,
                duration: parseInt(String(formData.duration)) || 30,
                ...formData, 
                status: undefined, // Status is handled separately
                 // Exclude eligibility upload data from the main product save
                eligibilityUpload: undefined, 
                eligibilityUploadId: product.eligibilityUploadId,
             };
             
            const originalProduct = provider.products.find(p => p.id === product.id);

            const payload = {
                original: originalProduct,
                updated: productToSave
            };

            const response = await fetch('/api/settings/pending-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entityType: 'LoanProduct',
                    entityId: product.id,
                    changeType: 'UPDATE',
                    payload: JSON.stringify(payload)
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to submit product changes for approval.');
            }

            onUpdate({ status: 'PENDING_APPROVAL' });

            toast({
                title: 'Submitted for Approval',
                description: `Changes to ${product.name} have been submitted successfully.`,
            });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }
    
    const handleDeleteFilter = async () => {
        if (!product.eligibilityUploadId) return;
        
        try {
            const productToDeleteFilter = provider.products.find(p => p.id === product.id);

            const payload = {
                original: productToDeleteFilter,
                updated: { ...productToDeleteFilter, eligibilityUploadId: null, eligibilityFilter: null, eligibilityUpload: undefined }
            };

            const response = await fetch('/api/settings/pending-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entityType: 'EligibilityList',
                    entityId: product.id,
                    changeType: 'DELETE',
                    payload: JSON.stringify(payload),
                }),
            });

             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Could not submit filter deletion for approval.');
            }
            onUpdate({ eligibilityUpload: { ...product.eligibilityUpload, status: 'PENDING_APPROVAL' } as any});
            toast({ title: 'Deletion Submitted', description: 'The eligibility filter deletion is pending approval.' });

        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };


    return (
       <>
       <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
            <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full space-x-4 px-4 py-2 border rounded-lg bg-background hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{product.name}</h4>
                        {product.status === 'PENDING_APPROVAL' && <Badge variant="outline">Pending Approval</Badge>}
                        {product.status !== 'PENDING_APPROVAL' && <Badge variant={product.status === 'Active' ? 'default' : 'destructive'} className={cn(product.status === 'Active' && 'bg-green-600')}>{product.status}</Badge>}
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                 <form onSubmit={submitForApproval} className="p-4 border rounded-lg bg-background space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center space-x-2">
                            <Switch 
                                id={`status-${product.id}`}
                                checked={formData.status === 'Active'} 
                                onCheckedChange={(checked) => handleSwitchChange('status', checked)}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                            <Label htmlFor={`status-${product.id}`}>Status ({formData.status})</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch
                                id={`allowConcurrentLoans-${product.id}`}
                                checked={!!formData.allowConcurrentLoans}
                                onCheckedChange={(checked) => onUpdate({ allowConcurrentLoans: checked })}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                            <Label htmlFor={`allowConcurrentLoans-${product.id}`}>Combinable with Other Loans</Label>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`minLoan-${product.id}`}>Min Loan Amount</Label>
                            <Input
                                id={`minLoan-${product.id}`}
                                name="minLoan"
                                type="number"
                                value={formData.minLoan ?? ''}
                                onChange={handleChange}
                                placeholder="e.g., 500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`maxLoan-${product.id}`}>Max Loan Amount</Label>
                            <Input
                                id={`maxLoan-${product.id}`}
                                name="maxLoan"
                                type="number"
                                value={formData.maxLoan ?? ''}
                                onChange={handleChange}
                                placeholder="e.g., 2500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`duration-${product.id}`}>Loan Duration (days)</Label>
                            <Input
                                id={`duration-${product.id}`}
                                name="duration"
                                type="number"
                                value={formData.duration ?? ''}
                                onChange={handleChange}
                                placeholder="e.g., 30"
                            />
                        </div>
                    </div>
                    
                     <div className="space-y-4 border-t pt-6">
                        <div className="flex items-center space-x-2">
                            <Switch
                                id={`dataProvisioningEnabled-${product.id}`}
                                checked={!!formData.dataProvisioningEnabled}
                                onCheckedChange={(checked) => onUpdate({ dataProvisioningEnabled: checked })}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                            <Label htmlFor={`dataProvisioningEnabled-${product.id}`}>Eligibility Allow-List</Label>
                        </div>
                        {formData.dataProvisioningEnabled && (
                            <div className="pl-8 space-y-4">
                               <div className="space-y-2">
                                    <Label>Link Data Source</Label>
                                    <Select 
                                        value={product.dataProvisioningConfigId || ''}
                                        onValueChange={(value) => onUpdate({ dataProvisioningConfigId: value })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select a data source to link..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {allDataConfigs.map(config => (
                                                <SelectItem key={config.id} value={config.id}>{config.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">Select the data source this product's eligibility list will be based on.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Upload List</Label>
                                    <div className="flex items-center gap-4">
                                        <Button asChild variant="outline" size="sm">
                                             <label htmlFor={`filter-upload-${product.id}`} className={cn("cursor-pointer", !product.dataProvisioningConfigId && 'cursor-not-allowed opacity-50')}>
                                                <Upload className="h-4 w-4 mr-2"/>
                                                {isUploading ? "Uploading..." : "Upload Excel File"}
                                                <input
                                                    ref={fileInputRef}
                                                    id={`filter-upload-${product.id}`}
                                                    type="file"
                                                    accept=".xlsx, .xls"
                                                    onChange={handleFilterFileUpload}
                                                    className="hidden"
                                                    disabled={isUploading || !product.dataProvisioningConfigId}
                                                />
                                            </label>
                                        </Button>
                                         <p className="text-xs text-muted-foreground">Upload a file to generate the filter. The headers must match the linked data source.</p>
                                    </div>
                                    {!product.dataProvisioningConfigId && <p className="text-xs text-destructive">A data source must be linked before uploading.</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Uploaded List</Label>
                                    {product.eligibilityUpload ? (
                                         <div className="border rounded-lg p-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-medium">{product.eligibilityUpload.fileName}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        By {product.eligibilityUpload.uploadedBy} on {format(new Date(product.eligibilityUpload.uploadedAt), "MMM d, yyyy 'at' h:mm a")}
                                                    </p>
                                                    {product.eligibilityUpload.status === 'PENDING_APPROVAL' && (
                                                        <Badge variant="outline" className="mt-1">Pending Approval</Badge>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => setViewingUpload(product.eligibilityUpload)}>View</Button>
                                                    <Button variant="destructive" size="sm" onClick={handleDeleteFilter}>Delete List</Button>
                                                </div>
                                            </div>
                                             {/* New dedicated approval button - Corrected logic */}
                                             {product.eligibilityUpload && 'fileContent' in product.eligibilityUpload && product.eligibilityUpload.status !== 'PENDING_APPROVAL' && (
                                                <Button onClick={handleEligibilitySubmitForApproval} size="sm" className="mt-2 text-white" style={{backgroundColor: providerColor}}>
                                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Submit Eligibility for Approval"}
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No eligibility list has been uploaded for this product.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center space-x-2 justify-end">
                        <Button variant="destructive" type="button" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
                        <Button type="submit" style={{ backgroundColor: providerColor }} className="text-white" disabled={isSaving || product.status === 'PENDING_APPROVAL'}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {product.status === 'PENDING_APPROVAL' ? 'Pending Approval' : 'Submit for Approval'}
                        </Button>
                    </div>
                </form>
            </CollapsibleContent>
        </Collapsible>
        {viewingUpload && (
             <UploadDataViewerDialog
                upload={viewingUpload}
                onClose={() => setViewingUpload(null)}
            />
        )}
       </>
    )
}

function ProvidersTab({ providers, onProvidersChange }: { 
    providers: LoanProvider[],
    onProvidersChange: (updater: React.SetStateAction<LoanProvider[]>) => void;
}) {
    const { currentUser } = useAuth();
    const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<LoanProvider | null>(null);
    const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<{ type: 'provider' | 'product'; providerId: string; productId?: string } | null>(null);
    const [dataConfigs, setDataConfigs] = useState<DataProvisioningConfig[]>(providers.flatMap(p => p.dataProvisioningConfigs || []));

    const { toast } = useToast();
    
    useEffect(() => {
        setDataConfigs(providers.flatMap(p => p.dataProvisioningConfigs || []));
    }, [providers]);
    
    const themeColor = useMemo(() => {
        if (currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') {
            return providers.find(p => p.name === 'NIb Bank')?.colorHex || '#fdb913';
        }
        return providers.find(p => p.name === currentUser?.providerName)?.colorHex || '#fdb913';
    }, [currentUser, providers]);
    
    const handleOpenProviderDialog = (provider: LoanProvider | null = null) => {
        setEditingProvider(provider);
        setIsProviderDialogOpen(true);
    };

    const handleSaveProvider = async (providerData: Partial<Omit<LoanProvider, 'products' | 'dataProvisioningConfigs' | 'id' | 'initialBalance'>> & { id?: string }) => {
        const isEditing = !!providerData.id;
        try {
            const changeType = isEditing ? 'UPDATE' : 'CREATE';
            const entityId = isEditing ? providerData.id : undefined;

            let originalProvider = null;
            if (isEditing && entityId) {
                originalProvider = providers.find(p => p.id === entityId) || null;
            }

            const payload = {
                original: originalProvider,
                updated: { ...originalProvider, ...providerData },
                created: !isEditing ? providerData : undefined,
            };

            const response = await fetch('/api/settings/pending-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entityType: 'LoanProvider',
                    entityId,
                    changeType,
                    payload: JSON.stringify(payload)
                }),
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error?.message || `Failed to submit provider changes`);
            }

            onProvidersChange(produce(draft => {
                if (isEditing && entityId) {
                    const index = draft.findIndex(p => p.id === entityId);
                    if (index !== -1) draft[index].status = 'PENDING_APPROVAL';
                }
            }));

            toast({ title: 'Submitted for Approval', description: `Changes for ${providerData.name} have been submitted for review.` });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    };
    
    const handleOpenAddProductDialog = (providerId: string) => {
        setSelectedProviderId(providerId);
        setIsAddProductDialogOpen(true);
    };

    const handleAddProduct = async (newProductData: Omit<LoanProduct, 'id' | 'status' | 'serviceFee' | 'dailyFee' | 'penaltyRules' | 'providerId' > & { icon?: string }) => {
        if (!selectedProviderId) return;

        try {
             const response = await fetch('/api/settings/pending-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entityType: 'LoanProduct',
                    changeType: 'CREATE',
                    payload: JSON.stringify({ created: { ...newProductData, providerId: selectedProviderId } })
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to submit new product for approval');
            }
            // Note: The product is not added to the local state, as it will only appear after approval.
            toast({ title: "Submitted for Approval", description: `${newProductData.name} has been submitted for review.` });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    };

    const handleUpdateProduct = (providerId: string, updatedProduct: LoanProduct) => {
        onProvidersChange(produce(draft => {
            const provider = draft.find(p => p.id === providerId);
            if (provider) {
                const productIndex = provider.products.findIndex(p => p.id === updatedProduct.id);
                if (productIndex !== -1) {
                     provider.products[productIndex] = { ...provider.products[productIndex], ...updatedProduct };
                }
            }
        }));
    }

    
    const confirmDelete = () => {
        if (!deletingId) return;

        if (deletingId.type === 'provider') {
            handleDeleteProvider(deletingId.providerId);
        } else if (deletingId.type === 'product' && deletingId.productId) {
            handleDeleteProduct(deletingId.providerId, deletingId.productId);
        }
        setDeletingId(null);
    }
    
    const handleDeleteProvider = async (providerId: string) => {
        try {
             const providerToDelete = providers.find(p => p.id === providerId);
             if (!providerToDelete) throw new Error('Provider not found');

            const response = await fetch(`/api/settings/pending-changes`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entityType: 'LoanProvider',
                    entityId: providerId,
                    changeType: 'DELETE',
                    payload: JSON.stringify({ original: providerToDelete })
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Could not submit deletion for approval.');
            }
            
            onProvidersChange(produce(draft => {
                const index = draft.findIndex(p => p.id === providerId);
                if (index !== -1) draft[index].status = 'PENDING_APPROVAL';
            }));

            toast({ title: "Deletion Submitted", description: 'Provider deletion is pending approval.' });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    }
    
    const handleDeleteProduct = async (providerId: string, productId: string) => {
        try {
            const provider = providers.find(p => p.id === providerId);
            const productToDelete = provider?.products.find(p => p.id === productId);
            if (!productToDelete) throw new Error("Product not found");

             const response = await fetch('/api/settings/pending-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    entityType: 'LoanProduct',
                    entityId: productId,
                    changeType: 'DELETE',
                    payload: JSON.stringify({ original: productToDelete })
                 }),
             });
             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Could not submit product deletion for approval.');
            }
            
             onProvidersChange(produce(draft => {
                const provider = draft.find(p => p.id === providerId);
                if (provider) {
                    const product = provider.products.find(p => p.id === productId);
                    if (product) product.status = 'PENDING_APPROVAL';
                }
            }));
            toast({ title: "Deletion Submitted", description: "Product deletion is pending approval." });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    }
    
    if (providers.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Providers &amp; Products</CardTitle>
                    <CardDescription>No providers available. Please contact a Super Admin.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
    <>
      <div className="flex items-center justify-between space-y-2 mb-4">
        <div></div>
        {(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') && (
          <Button onClick={() => handleOpenProviderDialog(null)} style={{ backgroundColor: themeColor }} className="text-white">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Provider
          </Button>
        )}
      </div>
      <Accordion type="multiple" className="w-full space-y-4">
        {providers.map((provider) => (
          <AccordionItem value={provider.id} key={provider.id} className="border rounded-lg bg-card">
            <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline">
                <div className="flex items-center gap-4">
                  <IconDisplay iconName={provider.icon} className="h-6 w-6" />
                  <div>
                    <div className="text-lg font-semibold">{provider.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center">
                        {(provider.products || []).length} products
                        {provider.status === 'PENDING_APPROVAL' && <Badge variant="outline" className="ml-2">Pending Approval</Badge>}
                    </div>
                  </div>
                </div>
              <div className="flex items-center gap-2 ml-auto pl-4">
                {(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') && (
                  <>
                    <Button variant="ghost" size="icon" className="hover:bg-muted h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenProviderDialog(provider); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:bg-destructive hover:text-destructive-foreground h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeletingId({ type: 'provider', providerId: provider.id }); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 border-t">
              <div className="space-y-6">
                {(provider.products || []).map(product => (
                  <ProductSettingsForm 
                    key={product.id}
                    provider={provider}
                    product={{...product, icon: product.icon || 'PersonStanding'}} 
                    providerColor={provider.colorHex} 
                    onSave={(savedProduct) => handleUpdateProduct(provider.id, savedProduct)}
                    onDelete={() => setDeletingId({ type: 'product', providerId: provider.id, productId: product.id })}
                    onUpdate={(updatedFields) => handleUpdateProduct(provider.id, { id: product.id, ...updatedFields })}
                    allDataConfigs={dataConfigs.filter(c => c.providerId === provider.id)}
                  />
                ))}
                {currentUser?.permissions?.['products']?.create && (
                    <Button 
                    variant="outline" 
                    className="w-full hover:text-white"
                    onClick={() => handleOpenAddProductDialog(provider.id)}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = provider.colorHex || themeColor; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                    >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
                    </Button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <AddProviderDialog
        isOpen={isProviderDialogOpen}
        onClose={() => setIsProviderDialogOpen(false)}
        onSave={handleSaveProvider}
        provider={editingProvider}
        primaryColor={themeColor}
      />
      <AddProductDialog
        isOpen={isAddProductDialogOpen}
        onClose={() => setIsAddProductDialogOpen(false)}
        onAddProduct={handleAddProduct}
      />
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will submit a request to delete the selected item. This cannot be undone once approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Submit for Deletion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
    );
}

type DailyFeeRule = FeeRule & { calculationBase?: 'principal' | 'compound' };

const FeeInput = ({ label, fee, onChange, isEnabled }: { label: string; fee: FeeRule; onChange: (fee: FeeRule) => void; isEnabled: boolean; }) => {
    return (
        <div className="flex items-center gap-2">
            <Label className={cn("w-28", !isEnabled && "text-muted-foreground/50")}>{label}</Label>
            <Select value={fee.type} onValueChange={(type: 'fixed' | 'percentage') => onChange({ ...fee, type })} disabled={!isEnabled}>
                <SelectTrigger className="w-32" disabled={!isEnabled}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
            </Select>
            <div className="relative flex-1">
                <Input
                    type="number"
                    value={fee.value ?? ''}
                    onChange={(e) => onChange({ ...fee, value: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="Enter value"
                    className={cn(fee.type === 'percentage' ? "pr-8" : "")}
                    disabled={!isEnabled}
                />
                {fee.type === 'percentage' && <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground", !isEnabled && "text-muted-foreground/50")}>%</span>}
            </div>
        </div>
    );
};

const DailyFeeInput = ({ label, fee, onChange, isEnabled }: { label: string; fee: DailyFeeRule; onChange: (fee: DailyFeeRule) => void; isEnabled: boolean; }) => {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <Label className={cn("w-28", !isEnabled && "text-muted-foreground/50")}>{label}</Label>
                <Select value={fee.type} onValueChange={(type: 'fixed' | 'percentage') => onChange({ ...fee, type, calculationBase: type === 'fixed' ? undefined : fee.calculationBase || 'principal' })} disabled={!isEnabled}>
                    <SelectTrigger className="w-32" disabled={!isEnabled}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                </Select>
                <div className="relative flex-1">
                    <Input
                        type="number"
                        value={fee.value ?? ''}
                        onChange={(e) => onChange({ ...fee, value: e.target.value === '' ? '' : Number(e.target.value) })}
                        placeholder="Enter value"
                        className={cn(fee.type === 'percentage' ? "pr-8" : "")}
                        disabled={!isEnabled}
                    />
                    {fee.type === 'percentage' && <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground", !isEnabled && "text-muted-foreground/50")}>%</span>}
                </div>
            </div>
            {isEnabled && fee.type === 'percentage' && (
                <div className="flex items-center gap-2 pl-[124px]">
                    <Label className="w-32 text-sm text-muted-foreground">Calculation Base</Label>
                    <Select value={fee.calculationBase || 'principal'} onValueChange={(base: 'principal' | 'compound') => onChange({ ...fee, calculationBase: base })}>
                        <SelectTrigger className="flex-1">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="principal">Principal</SelectItem>
                            <SelectItem value="compound">Compound (Principal + Accrued)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
};

const PenaltyRuleRow = ({ rule, onChange, onRemove, color, isEnabled }: { rule: PenaltyRule, onChange: (rule: PenaltyRule) => void, onRemove: () => void, color?: string, isEnabled: boolean }) => {
    return (
        <div className="flex items-center gap-2">
            <Input 
                type="number" 
                value={rule.fromDay ?? ''}
                onChange={(e) => onChange({...rule, fromDay: e.target.value === '' ? '' : parseInt(e.target.value)})}
                placeholder="From"
                className="w-20"
                disabled={!isEnabled}
            />
            <Input 
                type="number" 
                value={rule.toDay === Infinity ? '' : (rule.toDay ?? '')}
                onChange={(e) => onChange({...rule, toDay: e.target.value === '' ? null : parseInt(e.target.value)})}
                placeholder="To"
                className="w-20"
                disabled={!isEnabled}
            />
            <Select value={rule.type} onValueChange={(type: 'fixed' | 'percentageOfPrincipal' | 'percentageOfCompound') => onChange({ ...rule, type })} disabled={!isEnabled}>
                <SelectTrigger className="w-48" disabled={!isEnabled}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentageOfPrincipal">Percentage of Principal</SelectItem>
                    <SelectItem value="percentageOfCompound">Percentage of Compound</SelectItem>
                </SelectContent>
            </Select>
             <Select value={rule.frequency || 'daily'} onValueChange={(freq: 'daily' | 'one-time') => onChange({ ...rule, frequency: freq })} disabled={!isEnabled}>
                <SelectTrigger className="w-36" disabled={!isEnabled}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="one-time">One Time</SelectItem>
                </SelectContent>
            </Select>
             <div className="relative flex-1">
                <Input
                    type="number"
                    value={rule.value ?? ''}
                    onChange={(e) => onChange({ ...rule, value: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="Value"
                    className={cn(rule.type !== 'fixed' ? "pr-8" : "")}
                    disabled={!isEnabled}
                />
                 {rule.type !== 'fixed' && <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground", !isEnabled && "text-muted-foreground/50")}>%</span>}
            </div>
             <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive" disabled={!isEnabled}><Trash2 className="h-4 w-4" /></Button>
        </div>
    );
};

function LoanTiersForm({ product, onUpdate, color }: {
    product: LoanProduct;
    onUpdate: (updatedProduct: Partial<LoanProduct>) => void;
    color?: string;
}) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const tiers = product.loanAmountTiers || [];

    const handleTierChange = (index: number, field: keyof Omit<LoanAmountTier, 'id' | 'productId'>, value: string) => {
        const newTiers = produce(tiers, draft => {
            const newTier = { ...draft[index], [field]: value === '' ? '' : value };
            draft[index] = newTier;

            if (field === 'toScore' && index < draft.length - 1) {
                const nextTier = { ...draft[index + 1] };
                nextTier.fromScore = (Number(value) || 0) + 1;
                draft[index + 1] = nextTier;
            }
        });
        onUpdate({ loanAmountTiers: newTiers });
    };

    const handleAddTier = () => {
        const lastTier = tiers[tiers.length - 1];
        const newFromScore = lastTier ? (Number(lastTier.toScore) || 0) + 1 : 0;
        
        const newTier: LoanAmountTier = {
            id: `tier-${Date.now()}`,
            productId: product.id,
            fromScore: newFromScore,
            toScore: newFromScore + 9,
            loanAmount: 0
        };

        onUpdate({ loanAmountTiers: [...tiers, newTier]});
    };

    const handleRemoveTier = (index: number) => {
        const newTiers = tiers.filter((_, i) => i !== index);
        onUpdate({ loanAmountTiers: newTiers });
    };
    
    const handleSaveTiers = async () => {
        setIsLoading(true);
        try {
            const tiersToSend = tiers.map((tier, i) => {
                const fromScore = Number(tier.fromScore);
                const toScore = Number(tier.toScore);
                const loanAmount = Number(tier.loanAmount);

                if (isNaN(fromScore) || isNaN(toScore) || isNaN(loanAmount)) {
                    toast({ title: 'Invalid Tier', description: `In tier #${i + 1}, all fields must be valid numbers.`, variant: 'destructive'});
                    throw new Error("Invalid tier data");
                }
                if (loanAmount <= 0) {
                    toast({ title: 'Invalid Loan Amount', description: `In tier #${i + 1}, the loan amount must be positive.`, variant: 'destructive'});
                    throw new Error("Invalid loan amount");
                }
                 if (product.maxLoan != null && loanAmount > product.maxLoan) {
                    toast({ title: 'Invalid Loan Amount', description: `In tier #${i + 1}, the loan amount cannot exceed the product's maximum of ${product.maxLoan}.`, variant: 'destructive'});
                    throw new Error("Invalid loan amount");
                }
                if (fromScore > toScore) {
                    toast({ title: 'Invalid Tier', description: `In tier #${i + 1}, the "From Score" cannot be greater than the "To Score".`, variant: 'destructive'});
                    throw new Error("Invalid tier data");
                }
                if (i > 0) {
                    const prevToScore = Number(tiers[i-1].toScore);
                    if (fromScore <= prevToScore) {
                        toast({ title: 'Overlapping Tiers', description: `Tier #${i + 1} overlaps with the previous tier. "From Score" must be greater than the previous "To Score".`, variant: 'destructive'});
                        throw new Error("Overlapping Tiers");
                    }
                }
                return {
                    ...tier,
                    fromScore,
                    toScore,
                    loanAmount,
                    id: String(tier.id).startsWith('tier-') ? undefined : tier.id
                }
            });

            // This update is now part of the parent's save logic.
            onUpdate({ loanAmountTiers: tiersToSend });
            toast({ title: 'Tiers Updated', description: 'Tiers have been staged for approval. Submit the product changes to finalize.' });
            
        } catch (error: any) {
            // Validation errors are already toasted.
            if (!["Invalid tier data", "Invalid loan amount", "Overlapping Tiers"].includes(error.message)) {
                toast({ title: 'Error Updating Tiers', description: error.message, variant: 'destructive' });
            }
        } finally {
            setIsLoading(false);
        }
    };


    return (
         <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
            <Card>
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Loan Amount Tiers</CardTitle>
                                <CardDescription>Define loan amounts based on credit scores for this product.</CardDescription>
                            </div>
                            <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                         {tiers.map((tier, index) => (
                            <div key={tier.id} className="flex items-center gap-4 p-2 rounded-md bg-muted/50">
                                <Label className="w-20">From Score</Label>
                                <Input
                                    type="number"
                                    value={tier.fromScore ?? ''}
                                    onChange={(e) => handleTierChange(index, 'fromScore', e.target.value)}
                                    className="w-28"
                                    disabled={index > 0} // Only first "from" is editable
                                />
                                <Label className="w-16">To Score</Label>
                                 <Input
                                    type="number"
                                    value={tier.toScore ?? ''}
                                    onChange={(e) => handleTierChange(index, 'toScore', e.target.value)}
                                    className="w-28"
                                />
                                <Label className="w-24">Loan Amount</Label>
                                 <Input
                                    type="number"
                                    value={tier.loanAmount ?? ''}
                                    onChange={(e) => handleTierChange(index, 'loanAmount', e.target.value)}
                                    className="flex-1"
                                />
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveTier(index)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        ))}
                         <Button variant="outline" onClick={handleAddTier} className="w-full">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Tier
                        </Button>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

function ProductConfiguration({ product, providerColor, onProductUpdate, taxConfig }: { 
    product: LoanProduct; 
    providerColor?: string;
    onProductUpdate: (updatedProduct: LoanProduct) => void;
    taxConfig: Tax;
}) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const taxAppliedTo = useMemo(() => typeof taxConfig.appliedTo === 'string' ? JSON.parse(taxConfig.appliedTo) : taxConfig.appliedTo || [], [taxConfig.appliedTo]);

    const parsedProduct = useMemo(() => {
        const serviceFee = typeof product.serviceFee === 'string' ? JSON.parse(product.serviceFee) : product.serviceFee;
        const dailyFee = typeof product.dailyFee === 'string' ? JSON.parse(product.dailyFee) : product.dailyFee;
        const penaltyRules = typeof product.penaltyRules === 'string' ? JSON.parse(product.penaltyRules) : product.penaltyRules.map((r: any) => ({ ...r, frequency: r.frequency || 'daily' }));
        return {
            ...product,
            serviceFee,
            dailyFee,
            penaltyRules,
        };
    }, [product]);
    
    const [config, setConfig] = useState(parsedProduct);

    useEffect(() => {
        setConfig(parsedProduct);
    }, [parsedProduct]);

    const handleUpdate = (update: Partial<LoanProduct>) => {
        setConfig(prev => ({...prev, ...update}));
    };

    const handleAddPenaltyRule = () => {
        const newRule: PenaltyRule = {
            id: `penalty-${Date.now()}`,
            fromDay: 1,
            toDay: null,
            type: 'fixed',
            value: 0,
            frequency: 'daily'
        };
        setConfig(prev => ({...prev, penaltyRules: [...prev.penaltyRules, newRule]}));
    };

    const handleRemovePenaltyRule = (ruleId: string) => {
        setConfig(prev => ({...prev, penaltyRules: prev.penaltyRules.filter(r => r.id !== ruleId)}));
    };
    
    const handleUpdatePenaltyRule = (ruleId: string, updatedRule: PenaltyRule) => {
         setConfig(prev => ({
            ...prev,
            penaltyRules: prev.penaltyRules.map(r => r.id === ruleId ? updatedRule : r)
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                original: product, // The original product state before edits
                updated: config,   // The new state from the form
            };
            const response = await fetch('/api/settings/pending-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entityType: 'LoanProduct',
                    entityId: product.id,
                    changeType: 'UPDATE',
                    payload: JSON.stringify(payload)
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to submit changes for approval.');
            }

            // Update the parent state to reflect pending status
            onProductUpdate({ ...config, status: 'PENDING_APPROVAL' });
            
            toast({
                title: 'Submitted for Approval',
                description: `Changes for ${config.name} have been submitted successfully.`,
            });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
            <CollapsibleTrigger asChild>
                 <div className="flex items-center justify-between w-full space-x-4 px-4 py-2 border rounded-lg bg-background hover:bg-muted/50 transition-colors cursor-pointer">
                    <h4 className="text-sm font-semibold">{product.name}</h4>
                    {config.status === 'PENDING_APPROVAL' ? (
                        <Badge variant="outline">Pending Approval</Badge>
                    ) : (
                        <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                    )}
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                 <Card className="border-t-0 rounded-t-none">
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex items-center justify-between border-b pb-4">
                            <div className="flex items-center gap-2">
                                <Label htmlFor={`serviceFeeEnabled-${config.id}`} className="font-medium">Service Fee</Label>
                                {taxAppliedTo.includes('serviceFee') && <Badge variant="outline" className="text-xs">Taxable ({taxConfig.rate}%)</Badge>}
                            </div>
                            <Switch
                                id={`serviceFeeEnabled-${config.id}`}
                                checked={config.serviceFeeEnabled}
                                onCheckedChange={(checked) => handleUpdate({ serviceFeeEnabled: checked })}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                        </div>
                    <FeeInput 
                            label="Fee Details"
                            fee={config.serviceFee}
                            onChange={(fee) => handleUpdate({ serviceFee: fee })}
                            isEnabled={!!config.serviceFeeEnabled}
                        />
                        
                        <div className="flex items-center justify-between border-b pb-4 pt-4">
                             <div className="flex items-center gap-2">
                                <Label htmlFor={`dailyFeeEnabled-${config.id}`} className="font-medium">Daily Fee</Label>
                                {taxAppliedTo.includes('interest') && <Badge variant="outline" className="text-xs">Taxable ({taxConfig.rate}%)</Badge>}
                            </div>
                            <Switch
                                id={`dailyFeeEnabled-${config.id}`}
                                checked={config.dailyFeeEnabled}
                                onCheckedChange={(checked) => handleUpdate({ dailyFeeEnabled: checked })}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                        </div>
                        <DailyFeeInput 
                            label="Fee Details"
                            fee={config.dailyFee}
                            onChange={(fee) => handleUpdate({ dailyFee: fee })}
                            isEnabled={!!config.dailyFeeEnabled}
                        />
                        
                        <div className="flex items-center justify-between border-b pb-4 pt-4">
                             <div className="flex items-center gap-2">
                                <Label htmlFor={`penaltyRulesEnabled-${config.id}`} className="font-medium">Penalty Rules</Label>
                                 {taxAppliedTo.includes('penalty') && <Badge variant="outline" className="text-xs">Taxable ({taxConfig.rate}%)</Badge>}
                            </div>
                            <Switch
                                id={`penaltyRulesEnabled-${config.id}`}
                                checked={config.penaltyRulesEnabled}
                                onCheckedChange={(checked) => handleUpdate({ penaltyRulesEnabled: checked })}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                        </div>
                        <div>
                            <div className="space-y-2 p-4 border rounded-md bg-muted/50">
                                {config.penaltyRules.map((rule) => (
                                    <PenaltyRuleRow
                                        key={rule.id}
                                        rule={rule}
                                        onChange={(updatedRule) => handleUpdatePenaltyRule(rule.id, updatedRule)}
                                        onRemove={() => handleRemovePenaltyRule(rule.id)}
                                        color={providerColor}
                                        isEnabled={!!config.penaltyRulesEnabled}
                                    />
                                ))}
                                <Button variant="outline" size="sm" onClick={handleAddPenaltyRule} disabled={!config.penaltyRulesEnabled}>
                                    <PlusCircle className="h-4 w-4 mr-2" /> Add Penalty Rule
                                </Button>
                            </div>
                        </div>
                        
                        <div className="pt-4">
                            <LoanTiersForm
                                product={config}
                                onUpdate={(updatedProductData) => handleUpdate(updatedProductData)}
                                color={providerColor}
                            />
                        </div>

                </CardContent>
                <CardFooter>
                        <Button 
                            onClick={handleSave} 
                            size="sm"
                            style={{ backgroundColor: providerColor }}
                            className="text-white ml-auto"
                            disabled={isSaving || config.status === 'PENDING_APPROVAL'}
                        >
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {config.status === 'PENDING_APPROVAL' ? 'Pending Approval' : 'Submit for Approval'}
                        </Button>
                </CardFooter>
            </Card>
            </CollapsibleContent>
        </Collapsible>
    );
}

function ConfigurationTab({ providers, onProductUpdate, taxConfig }: { 
    providers: LoanProvider[],
    onProductUpdate: (providerId: string, updatedProduct: LoanProduct) => void;
    taxConfig: Tax;
}) {
    if (providers.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Product Fee Configuration</CardTitle>
                    <CardDescription>
                        No providers available to configure.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }
    
    return (
        <>
        <Accordion type="multiple" className="w-full space-y-4">
            {providers.map((provider) => (
                <AccordionItem value={provider.id} key={provider.id} className="border rounded-lg bg-card">
                    <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline">
                        <div className="flex items-center gap-4">
                            <IconDisplay iconName={provider.icon} className="h-6 w-6" />
                            <div>
                                <div className="text-lg font-semibold">{provider.name}</div>
                                <p className="text-sm text-muted-foreground">{(provider.products || []).length} products to configure</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border-t space-y-6">
                       {(provider.products || []).map(product => (
                            <ProductConfiguration
                                key={product.id}
                                product={product}
                                providerColor={provider.colorHex}
                                onProductUpdate={(updatedProduct) => onProductUpdate(provider.id, updatedProduct)}
                                taxConfig={taxConfig}
                            />
                       ))}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
        </>
    );
}

const TAX_COMPONENTS = [
    { id: 'serviceFee', label: 'Service Fee' },
    { id: 'interest', label: 'Daily Fee (Interest)' },
    { id: 'penalty', label: 'Penalty' },
];

function TaxTab({ initialTaxConfig }: { initialTaxConfig: Tax }) {
    const [taxConfig, setTaxConfig] = useState(initialTaxConfig);

    useEffect(() => {
        setTaxConfig(initialTaxConfig);
    }, [initialTaxConfig]);
    
    const appliedTo = useMemo(() => typeof taxConfig.appliedTo === 'string' ? JSON.parse(taxConfig.appliedTo) : taxConfig.appliedTo || [], [taxConfig.appliedTo]);

    return (
        <Card>
            <CardHeader className='flex-row items-start justify-between'>
                <div>
                    <CardTitle>Global Tax Configuration</CardTitle>
                    <CardDescription>This is a read-only view of the current system-wide tax settings.</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link href="/admin/tax">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Configuration
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label>Tax Rate (%)</Label>
                    <Input 
                        value={`${taxConfig.rate}%`}
                        readOnly
                        className="max-w-xs bg-muted"
                    />
                </div>
                <div className="space-y-4">
                    <Label>Tax is Applied On</Label>
                    <div className="space-y-2 rounded-md border p-4 bg-muted">
                        {TAX_COMPONENTS.map(component => (
                            <div key={component.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`tax-on-${component.id}-readonly`}
                                    checked={appliedTo.includes(component.id)}
                                    disabled
                                />
                                <Label htmlFor={`tax-on-${component.id}-readonly`} className="font-normal">{component.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function SettingsClient({ initialProviders, initialTaxConfig }: { initialProviders: LoanProvider[], initialTaxConfig: Tax }) {
    const [providers, setProviders] = useState(initialProviders);

    const onProductUpdate = useCallback((providerId: string, updatedProduct: Partial<LoanProduct>) => {
        setProviders(produce(draft => {
            const provider = draft.find(p => p.id === providerId);
            if (provider) {
                const productIndex = provider.products.findIndex(p => p.id === updatedProduct.id);
                if (productIndex !== -1) {
                    // Merge new fields into the existing product
                    provider.products[productIndex] = { ...provider.products[productIndex], ...updatedProduct };
                }
            }
        }));
    }, []);

    const handleProvidersChange = useCallback((updater: React.SetStateAction<LoanProvider[]>) => {
        setProviders(updater);
    }, []);
    
    const handleProviderUpdate = useCallback((update: Partial<LoanProvider>) => {
        setProviders(produce(draft => {
            const provider = draft.find(p => p.id === update.id);
            if (provider) {
                Object.assign(provider, update);
            }
        }));
    }, []);

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            <Tabs defaultValue="providers" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="providers">Providers & Products</TabsTrigger>
                    <TabsTrigger value="configuration">Fee & Tier Configuration</TabsTrigger>
                    <TabsTrigger value="agreement">Borrower Agreement</TabsTrigger>
                    <TabsTrigger value="tax">Tax</TabsTrigger>
                </TabsList>
                <TabsContent value="providers">
                    <ProvidersTab providers={providers} onProvidersChange={handleProvidersChange} />
                </TabsContent>
                <TabsContent value="configuration">
                     <ConfigurationTab providers={providers} onProductUpdate={onProductUpdate} taxConfig={initialTaxConfig} />
                </TabsContent>
                 <TabsContent value="agreement">
                    <Accordion type="multiple" className="w-full space-y-4">
                        {providers.map((provider) => (
                             <AccordionItem value={provider.id} key={provider.id} className="border rounded-lg bg-card">
                                 <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline">
                                    <div className="flex items-center gap-4">
                                        <IconDisplay iconName={provider.icon} className="h-6 w-6" />
                                        <div className="text-lg font-semibold">{provider.name}</div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 border-t">
                                    <AgreementTab provider={provider} onProviderUpdate={handleProviderUpdate} />
                                </AccordionContent>
                             </AccordionItem>
                        ))}
                    </Accordion>
                </TabsContent>
                <TabsContent value="tax">
                    <TaxTab initialTaxConfig={initialTaxConfig} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function AgreementTab({ provider, onProviderUpdate }: { provider: LoanProvider, onProviderUpdate: (update: Partial<LoanProvider>) => void }) {
    const { toast } = useToast();
    const [terms, setTerms] = useState<TermsAndConditions | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetchTerms = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/settings/terms?providerId=${provider.id}`);
                if (response.ok) {
                    const data = await response.json();
                    setTerms(data);
                }
            } catch (error) {
                 toast({ title: "Error", description: "Failed to load terms and conditions.", variant: "destructive"});
            } finally {
                setIsLoading(false);
            }
        };
        fetchTerms();
    }, [provider.id, toast]);
    
    const handleSave = async () => {
        if (!terms || !terms.content.trim()) {
            toast({ title: "Error", description: "Terms and conditions content cannot be empty.", variant: "destructive" });
            return;
        }
        setIsLoading(true);
        try {
            const originalTerms = provider.termsAndConditions?.find(t => t.isActive);
            const payload = {
                original: originalTerms,
                updated: { providerId: provider.id, content: terms.content }
            }

            const response = await fetch('/api/settings/pending-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entityType: 'TermsAndConditions',
                    entityId: originalTerms?.id || provider.id, // Use provider ID for new terms
                    changeType: 'UPDATE', // Always an update/new version
                    payload: JSON.stringify(payload)
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to submit new terms for approval.");
            }
            
            toast({ title: "Submitted for Approval", description: `A new version of the terms has been submitted for review.` });

        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };


    if (isLoading) {
        return <div className="space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-32" />
        </div>
    }

    return (
        <div className="space-y-4">
            <Label htmlFor={`terms-content-${provider.id}`}>Terms and Conditions Content</Label>
             <Textarea
                id={`terms-content-${provider.id}`}
                value={terms?.content || ''}
                onChange={(e) => setTerms(prev => ({ ...(prev || { version: 0, content: '' }), content: e.target.value }) as TermsAndConditions)}
                placeholder="Enter the terms and conditions for your loan products here."
                rows={15}
            />
            <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                    Current Version: {terms?.version || 0}
                </p>
                <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Save className="h-4 w-4 mr-2" />}
                    Submit New Version for Approval
                </Button>
            </div>
        </div>
    );
}

// --------------------------------------------------
// DATA PROVISIONING DIALOG (NEW COMPONENT)
// --------------------------------------------------
type EditableDataColumn = DataColumn & { optionsString?: string };

function DataProvisioningDialog({ isOpen, onClose, onSave, config }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: Omit<DataProvisioningConfig, 'providerId' | 'id' | 'uploads'> & { id?: string }) => void;
    config: DataProvisioningConfig | null;
}) {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [columns, setColumns] = useState<EditableDataColumn[]>([]);

    useEffect(() => {
        if (isOpen) {
            if (config) {
                setName(config.name);
                setColumns(config.columns.map(c => ({...c, optionsString: (c.options || []).join(', ') })) || []);
            } else {
                setName('');
                setColumns([]);
            }
        }
    }, [config, isOpen]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
            
            setColumns(headers.map((header, index) => ({
                id: `col-${Date.now()}-${index}`,
                name: header,
                type: 'string', // default type
                isIdentifier: index === 0, // default first column as identifier
                options: [],
                optionsString: '',
            })));
        };
        reader.readAsArrayBuffer(file);
    };

    const handleColumnChange = (index: number, field: keyof EditableDataColumn, value: string | boolean) => {
        setColumns(produce(draft => {
            if (field === 'isIdentifier' && typeof value === 'boolean') {
                // Ensure only one column can be the identifier
                draft.forEach((col, i) => {
                    col.isIdentifier = i === index ? value : false;
                });
            } else {
                 (draft[index] as any)[field] = value;
            }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!columns.some(c => c.isIdentifier)) {
            toast({ title: 'Error', description: 'Please mark one column as the customer identifier.', variant: 'destructive' });
            return;
        }

        // Process the final columns array before saving
        const finalColumns = columns.map(col => {
            const { optionsString, ...rest } = col;
            const finalOptions = optionsString ? optionsString.split(',').map(s => s.trim()).filter(Boolean) : [];
            return { ...rest, options: finalOptions };
        });

        onSave({ id: config?.id, name, columns: finalColumns });
        onClose();
    };

    return (
         <UIDialog open={isOpen} onOpenChange={onClose}>
            <UIDialogContent className="sm:max-w-2xl">
                <UIDialogHeader>
                    <UIDialogTitle>{config ? 'Edit' : 'Create'} Data Type</UIDialogTitle>
                     <UIDialogDescription>Define a new data schema by uploading a sample file.</UIDialogDescription>
                </UIDialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="data-type-name">Data Type Name</Label>
                        <Input id="data-type-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Credit Bureau Data" required />
                    </div>

                    <div>
                        <Label htmlFor="file-upload">Upload Sample File (.xlsx, .xls)</Label>
                        <Input id="file-upload" type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
                         <p className="text-xs text-muted-foreground mt-1">Upload a file to automatically detect columns.</p>
                    </div>

                    {columns.length > 0 && (
                        <div>
                            <Label>Configure Columns</Label>
                            <div className="space-y-4 mt-2 border p-4 rounded-md max-h-[50vh] overflow-y-auto">
                                {columns.map((col, index) => (
                                    <div key={col.id} className="space-y-2 p-2 rounded-md bg-muted/50">
                                        <div className="grid grid-cols-12 items-center gap-2">
                                            <Input
                                                className="col-span-5"
                                                value={col.name}
                                                onChange={e => handleColumnChange(index, 'name', e.target.value)}
                                                required
                                            />
                                            <Select value={col.type} onValueChange={(value: 'string' | 'number' | 'date') => handleColumnChange(index, 'type', value)}>
                                                <SelectTrigger className="col-span-3">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="string">Text</SelectItem>
                                                    <SelectItem value="number">Number</SelectItem>
                                                    <SelectItem value="date">Date</SelectItem>
                                                </SelectContent>
                                            </Select>
                                             <div className="col-span-4 flex items-center justify-end space-x-2">
                                                <Checkbox
                                                    id={`is-identifier-${col.id}`}
                                                    checked={col.isIdentifier}
                                                    onCheckedChange={(checked) => handleColumnChange(index, 'isIdentifier', !!checked)}
                                                />
                                                <Label htmlFor={`is-identifier-${col.id}`} className="text-sm text-muted-foreground whitespace-nowrap">Is Identifier?</Label>
                                            </div>
                                        </div>
                                         {col.type === 'string' && (
                                            <div className="space-y-1">
                                                <Label htmlFor={`options-${col.id}`} className="text-xs text-muted-foreground">Dropdown Options (optional)</Label>
                                                <Textarea
                                                    id={`options-${col.id}`}
                                                    placeholder="e.g., Male, Female, Other"
                                                    className="text-xs"
                                                    value={col.optionsString || ''}
                                                    onChange={e => handleColumnChange(index, 'optionsString', e.target.value)}
                                                />
                                                <p className="text-xs text-muted-foreground">Comma-separated values for dropdown select.</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <UIDialogFooter>
                        <UIDialogClose asChild><Button type="button" variant="outline">Cancel</Button></UIDialogClose>
                        <Button type="submit">Submit for Approval</Button>
                    </UIDialogFooter>
                </form>
            </UIDialogContent>
        </UIDialog>
    )
}

function UploadDataViewerDialog({ upload, onClose }: {
    upload: DataProvisioningUpload | null;
    onClose: () => void;
}) {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const rowsPerPage = 100;

    useEffect(() => {
        if (upload && !upload.id.startsWith('temp-')) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const response = await fetch(`/api/settings/data-provisioning-uploads/view?uploadId=${upload.id}&page=${page}&limit=${rowsPerPage}`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch uploaded data');
                    }
                    const result = await response.json();
                    setData(result.data);
                    setTotalPages(result.totalPages);
                    setTotalRows(result.totalRows);
                } catch (error) {
                    console.error(error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [upload, page]);

    if (!upload) return null;
    
    // Special handling for temporary filter preview
    if (upload.id.startsWith('temp-') && 'fileContent' in upload) {
        const buffer = Buffer.from((upload as any).fileContent, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
        const rows = jsonData;

        return (
             <UIDialog open={!!upload} onOpenChange={onClose}>
                <UIDialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <UIDialogHeader>
                        <UIDialogTitle>Viewing Upload: {upload.fileName}</UIDialogTitle>
                        <UIDialogDescription>
                            This is a preview of the data from your uploaded file.
                        </UIDialogDescription>
                    </UIDialogHeader>
                    <div className="flex-grow overflow-auto border rounded-md">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                    {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {headers.map((header, cellIndex) => (
                                            <TableCell key={`${rowIndex}-${cellIndex}`}>{row[header]}</TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     <UIDialogFooter className="pt-4">
                        <UIDialogClose asChild><Button type="button">Close</Button></UIDialogClose>
                    </UIDialogFooter>
                </UIDialogContent>
            </UIDialog>
        );
    }


    const headers = data.length > 0 ? Object.keys(data[0]) : [];

    return (
        <UIDialog open={!!upload} onOpenChange={onClose}>
            <UIDialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <UIDialogHeader>
                    <UIDialogTitle>Viewing Upload: {upload.fileName}</UIDialogTitle>
                    <UIDialogDescription>
                        Displaying {data.length} of {totalRows} rows from the uploaded file.
                    </UIDialogDescription>
                </UIDialogHeader>
                <div className="flex-grow overflow-auto border rounded-md">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                    {headers.map(header => <TableHead key={header} className="capitalize">{header.replace(/([A-Z])/g, ' $1')}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((row, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {headers.map(header => <TableCell key={`${rowIndex}-${header}`}>{row[header]}</TableCell>)}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
                <UIDialogFooter className="justify-between items-center pt-4">
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                            <ChevronLeft className="h-4 w-4 mr-2" /> Previous
                        </Button>
                        <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                            Next <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </UIDialogFooter>
            </UIDialogContent>
        </UIDialog>
    );
}
    

    















