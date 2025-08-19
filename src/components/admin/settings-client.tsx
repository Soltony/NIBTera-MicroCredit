

'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Trash2, Loader2, Edit, ChevronDown, Upload, Settings2, Save, FileClock } from 'lucide-react';
import type { LoanProvider, LoanProduct, FeeRule, PenaltyRule, DataProvisioningConfig, DataColumn, LoanAmountTier, DailyFeeRule, DataProvisioningUpload } from '@/lib/types';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { produce } from 'immer';
import { IconDisplay } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';


const ProductSettingsForm = ({ providerId, product, providerColor, onSave, onDelete }: { 
    providerId: string; 
    product: LoanProduct; 
    providerColor?: string; 
    onSave: (providerId: string, product: LoanProduct) => void;
    onDelete: (providerId: string, productId: string) => void;
}) => {
    const [formData, setFormData] = useState(product);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        setFormData(product);
    }, [product]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value === '' ? null : parseFloat(value) }));
    };

    const handleSwitchChange = (checked: boolean) => {
        setFormData(prev => ({...prev, status: checked ? 'Active' : 'Disabled' }));
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const response = await fetch('/api/settings/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    minLoan: parseFloat(String(formData.minLoan)) || 0,
                    maxLoan: parseFloat(String(formData.maxLoan)) || 0,
                }),
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || 'Failed to save product settings.');
            }
            onSave(providerId, formData);
            toast({ title: "Settings Saved", description: `Settings for ${product.name} have been updated.` });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="text-md font-semibold">{product.name}</div>
            <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-background">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-2">
                         <Switch 
                            id={`status-${product.id}`}
                            checked={formData.status === 'Active'} 
                            onCheckedChange={handleSwitchChange}
                            className="data-[state=checked]:bg-[--provider-color]"
                            style={{'--provider-color': providerColor} as React.CSSProperties}
                        />
                        <Label htmlFor={`status-${product.id}`}>{formData.status}</Label>
                    </div>
                     <div />
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
                </div>
                 <div className="flex items-center space-x-2 justify-end mt-6">
                    <Button variant="destructive" type="button" onClick={() => onDelete(providerId, product.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
                    <Button type="submit" style={{ backgroundColor: providerColor }} className="text-white" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
            </form>
        </div>
    )
}

function ProvidersTab({ providers: initialProviders }: { providers: LoanProvider[] }) {
    const [providers, setProviders] = useState(initialProviders);
    const { currentUser } = useAuth();
    const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<LoanProvider | null>(null);
    const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<{ type: 'provider' | 'product'; providerId: string; productId?: string } | null>(null);

    const { toast } = useToast();
    
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

    const handleSaveProvider = async (providerData: Omit<LoanProvider, 'id' | 'products'> & { id?: string }) => {
        const isEditing = !!providerData.id;
        const method = isEditing ? 'PUT' : 'POST';
        const endpoint = '/api/settings/providers';

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(providerData)
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'add'} provider`);
            }
            
            const savedProviderResponse = await response.json();
            
            setProviders(produce(draft => {
                if (isEditing) {
                    const index = draft.findIndex(p => p.id === savedProviderResponse.id);
                    if (index !== -1) {
                        const originalProvider = draft[index];
                        draft[index] = {
                            ...originalProvider,
                            ...savedProviderResponse,
                            products: originalProvider.products, // Preserve existing products
                        };
                    }
                } else {
                    draft.push(savedProviderResponse);
                }
            }));

            toast({ title: `Provider ${isEditing ? 'Updated' : 'Added'}`, description: `${savedProviderResponse.name} has been successfully saved.` });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    };
    
    const handleOpenAddProductDialog = (providerId: string) => {
        setSelectedProviderId(providerId);
        setIsAddProductDialogOpen(true);
    };

    const handleAddProduct = async (newProductData: Omit<LoanProduct, 'id' | 'status' | 'serviceFee' | 'dailyFee' | 'penaltyRules' | 'providerId'> & { icon?: string }) => {
        if (!selectedProviderId) return;

        try {
             const response = await fetch('/api/settings/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newProductData, providerId: selectedProviderId })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add product');
            }
            const newProduct = await response.json();

            setProviders(produce(draft => {
                const provider = draft.find(p => p.id === selectedProviderId);
                if (provider) {
                    provider.products.push(newProduct);
                }
            }));
            toast({ title: "Product Added", description: `${newProduct.name} has been added successfully.` });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    };

    const handleSaveProduct = (providerId: string, updatedProduct: LoanProduct) => {
        setProviders(produce(draft => {
            const provider = draft.find(p => p.id === providerId);
            if (provider) {
                const productIndex = provider.products.findIndex(p => p.id === updatedProduct.id);
                if (productIndex !== -1) {
                    provider.products[productIndex] = updatedProduct;
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
            const response = await fetch(`/api/settings/providers?id=${providerId}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Could not delete provider.');
            }
            setProviders(providers.filter(p => p.id !== providerId));
            toast({ title: "Provider Deleted" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    }
    
    const handleDeleteProduct = async (providerId: string, productId: string) => {
        try {
             const response = await fetch('/api/settings/products', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId }),
             });
             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Could not delete product.');
            }
             setProviders(produce(draft => {
                const provider = draft.find(p => p.id === providerId);
                if (provider) {
                    provider.products = provider.products.filter(p => p.id !== productId);
                }
            }));
            toast({ title: "Product Deleted" });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    }


    const visibleProviders = useMemo(() => {
        if (!currentUser || currentUser.role === 'Super Admin' || currentUser.role === 'Admin') {
            return providers;
        }
        return providers.filter(p => p.id === currentUser.providerId);
    }, [providers, currentUser]);


    return <>
        <div className="flex items-center justify-between space-y-2 mb-4">
            <div/>
             {(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') && (
                <Button onClick={() => handleOpenProviderDialog(null)} style={{ backgroundColor: themeColor }} className="text-white">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Provider
                </Button>
            )}
        </div>
        <Accordion type="multiple" className="w-full space-y-4">
            {visibleProviders.map((provider) => (
                <AccordionItem value={provider.id} key={provider.id} className="border rounded-lg bg-card">
                     <div className="flex items-center w-full p-4">
                        <AccordionTrigger className="flex-1 p-0 hover:no-underline text-left" hideChevron>
                           <div className="flex items-center gap-4">
                                <IconDisplay iconName={provider.icon} className="h-6 w-6" />
                                <div>
                                    <div className="text-lg font-semibold">{provider.name}</div>
                                    <p className="text-sm text-muted-foreground">{provider.products.length} products</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                         <div className="flex items-center gap-2 ml-auto pl-4">
                            {(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') && (
                                <>
                                    <Button variant="ghost" size="icon" className="hover:bg-muted h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenProviderDialog(provider); }}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="hover:bg-destructive hover:text-destructive-foreground h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeletingId({ type: 'provider', providerId: provider.id })}}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                             <AccordionTrigger className="p-2">
                               <span className="sr-only">Toggle</span>
                            </AccordionTrigger>
                        </div>
                    </div>
                    <AccordionContent className="p-4 border-t">
                        <div className="space-y-6">
                            {provider.products.map(product => (
                                 <ProductSettingsForm 
                                    key={product.id}
                                    providerId={provider.id}
                                    product={{...product, icon: product.icon || 'PersonStanding'}} 
                                    providerColor={provider.colorHex} 
                                    onSave={handleSaveProduct}
                                    onDelete={() => setDeletingId({ type: 'product', providerId: provider.id, productId: product.id })}
                                 />
                            ))}
                            <Button 
                                variant="outline" 
                                className="w-full hover:text-white"
                                onClick={() => handleOpenAddProductDialog(provider.id)}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = provider.colorHex || themeColor; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                            >
                                <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
                            </Button>
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
                        This action cannot be undone. This will permanently delete the selected item. If it has associated data (like products or loans), this action might be blocked.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>;
}

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
                    onChange={(e) => onChange({ ...fee, value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
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
                        onChange={(e) => onChange({ ...fee, value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
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
                placeholder="From Day"
                className="w-24"
                disabled={!isEnabled}
            />
            <Input 
                type="number" 
                value={rule.toDay === Infinity ? '' : (rule.toDay ?? '')}
                onChange={(e) => onChange({...rule, toDay: e.target.value === '' ? null : parseInt(e.target.value)})}
                placeholder="To Day"
                className="w-24"
                disabled={!isEnabled}
            />
            <Select value={rule.type} onValueChange={(type: 'fixed' | 'percentageOfPrincipal') => onChange({ ...rule, type })} disabled={!isEnabled}>
                <SelectTrigger className="w-48" disabled={!isEnabled}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentageOfPrincipal">Percentage of Principal</SelectItem>
                </SelectContent>
            </Select>
             <div className="relative flex-1">
                <Input
                    type="number"
                    value={rule.value ?? ''}
                    onChange={(e) => onChange({ ...rule, value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    placeholder="Value"
                    className={cn(rule.type === 'percentageOfPrincipal' ? "pr-8" : "")}
                    disabled={!isEnabled}
                />
                 {rule.type === 'percentageOfPrincipal' && <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground", !isEnabled && "text-muted-foreground/50")}>%</span>}
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
    const tiers = product.loanAmountTiers || [];

    const handleTierChange = (index: number, field: keyof Omit<LoanAmountTier, 'id' | 'productId'>, value: string) => {
        const newTiers = produce(tiers, draft => {
            (draft[index] as any)[field] = value === '' ? 0 : parseFloat(value);
        });

        // Auto-adjust the next tier's "fromScore"
        if (field === 'toScore' && index < newTiers.length - 1) {
             const fromScoreValue = (newTiers[index].toScore ?? 0) + 1;
             (newTiers[index + 1] as any).fromScore = fromScoreValue;
        }

        onUpdate({ loanAmountTiers: newTiers });
    };

    const handleAddTier = () => {
        const lastTier = tiers[tiers.length - 1];
        const newFromScore = lastTier ? (lastTier.toScore ?? 0) + 1 : 0;
        
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
        // Validation
        for (let i = 0; i < tiers.length; i++) {
            if ((tiers[i].fromScore ?? 0) > (tiers[i].toScore ?? 0)) {
                toast({ title: 'Invalid Tier', description: `In tier #${i + 1}, the "From Score" cannot be greater than the "To Score".`, variant: 'destructive'});
                return;
            }
            if (i > 0 && (tiers[i].fromScore ?? 0) <= (tiers[i-1].toScore ?? 0)) {
                 toast({ title: 'Overlapping Tiers', description: `Tier #${i + 1} overlaps with the previous tier. "From Score" must be greater than the previous "To Score".`, variant: 'destructive'});
                return;
            }
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/settings/loan-amount-tiers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: product.id, tiers: tiers.map(t => ({...t, id: String(t.id).startsWith('tier-') ? undefined : t.id})) }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save loan tiers.');
            }

            const savedTiers = await response.json();
            onUpdate({ loanAmountTiers: savedTiers });
            
            toast({ title: 'Success', description: 'Loan amount tiers have been saved successfully.' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Loan Amount Tiers</CardTitle>
                <CardDescription>Define loan amounts based on credit scores for this product.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            <CardFooter>
                 <Button onClick={handleSaveTiers} style={{ backgroundColor: color }} className="text-white ml-auto" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Tiers for {product.name}
                </Button>
            </CardFooter>
        </Card>
    );
}

function ConfigurationTab({ initialProviders, onUpdateProviders }: { 
    initialProviders: LoanProvider[],
    onUpdateProviders: React.Dispatch<React.SetStateAction<LoanProvider[]>>
}) {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    
    const visibleProviders = useMemo(() => {
        if (!currentUser || currentUser.role === 'Super Admin' || currentUser.role === 'Admin') {
            return initialProviders;
        }
        return initialProviders.filter(p => p.id === currentUser.providerId);
    }, [initialProviders, currentUser]);

    const handleProductChange = (providerId: string, productId: string, updatedProduct: Partial<LoanProduct>) => {
        onUpdateProviders(produce(draft => {
            const provider = draft.find(p => p.id === providerId);
            if (provider) {
                const product = provider.products.find(p => p.id === productId);
                if (product) {
                    Object.assign(product, updatedProduct);
                }
            }
        }));
    };
    
    const handleAddPenaltyRule = (providerId: string, productId: string) => {
        onUpdateProviders(produce(draft => {
             const provider = draft.find(p => p.id === providerId);
            if (provider) {
                const product = provider.products.find(p => p.id === productId);
                if (product) {
                    product.penaltyRules.push({
                        id: `penalty-${Date.now()}`,
                        fromDay: 1,
                        toDay: null,
                        type: 'fixed',
                        value: 0
                    });
                }
            }
        }));
    };
    
    const handleRemovePenaltyRule = (providerId: string, productId: string, ruleId: string) => {
        onUpdateProviders(produce(draft => {
            const provider = draft.find(p => p.id === providerId);
            if (provider) {
                const product = provider.products.find(p => p.id === productId);
                if (product) {
                    product.penaltyRules = product.penaltyRules.filter(r => r.id !== ruleId);
                }
            }
        }));
    };

    const handleSaveFees = async (providerId: string, product: LoanProduct) => {
        try {
            const response = await fetch('/api/settings/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...product, providerId: undefined }) // Don't send providerId in body for update
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save fees');
            }
            toast({ title: 'Fees Saved', description: `Fees for ${product.name} have been updated.` });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };
    
    if (visibleProviders.length === 0) {
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
        <Accordion type="multiple" className="w-full space-y-4">
            {visibleProviders.map((provider) => (
                <AccordionItem value={provider.id} key={provider.id} className="border rounded-lg bg-card">
                    <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline">
                        <div className="flex items-center gap-4">
                            <IconDisplay iconName={provider.icon} className="h-6 w-6" />
                            <div>
                                <div className="text-lg font-semibold">{provider.name}</div>
                                <p className="text-sm text-muted-foreground">{provider.products?.length || 0} products to configure</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border-t space-y-6">
                       {provider.products?.map(product => (
                           <Card key={product.id}>
                               <CardHeader>
                                   <CardTitle>{product.name}</CardTitle>
                               </CardHeader>
                               <CardContent className="space-y-4">
                                   <div className="flex items-center justify-between border-b pb-4">
                                        <Label htmlFor={`serviceFeeEnabled-${product.id}`} className="font-medium">Service Fee</Label>
                                        <Switch
                                            id={`serviceFeeEnabled-${product.id}`}
                                            checked={product.serviceFeeEnabled}
                                            onCheckedChange={(checked) => handleProductChange(provider.id, product.id, { serviceFeeEnabled: checked })}
                                            className="data-[state=checked]:bg-[--provider-color]"
                                            style={{'--provider-color': provider.colorHex} as React.CSSProperties}
                                        />
                                    </div>
                                   <FeeInput 
                                        label="Fee Details"
                                        fee={product.serviceFee}
                                        onChange={(fee) => handleProductChange(provider.id, product.id, { serviceFee: fee })}
                                        isEnabled={!!product.serviceFeeEnabled}
                                    />
                                    
                                    <div className="flex items-center justify-between border-b pb-4 pt-4">
                                        <Label htmlFor={`dailyFeeEnabled-${product.id}`} className="font-medium">Daily Fee</Label>
                                        <Switch
                                            id={`dailyFeeEnabled-${product.id}`}
                                            checked={product.dailyFeeEnabled}
                                            onCheckedChange={(checked) => handleProductChange(provider.id, product.id, { dailyFeeEnabled: checked })}
                                            className="data-[state=checked]:bg-[--provider-color]"
                                            style={{'--provider-color': provider.colorHex} as React.CSSProperties}
                                        />
                                    </div>
                                     <DailyFeeInput 
                                        label="Fee Details"
                                        fee={product.dailyFee}
                                        onChange={(fee) => handleProductChange(provider.id, product.id, { dailyFee: fee })}
                                        isEnabled={!!product.dailyFeeEnabled}
                                    />
                                    
                                     <div className="flex items-center justify-between border-b pb-4 pt-4">
                                        <Label htmlFor={`penaltyRulesEnabled-${product.id}`} className="font-medium">Penalty Rules</Label>
                                        <Switch
                                            id={`penaltyRulesEnabled-${product.id}`}
                                            checked={product.penaltyRulesEnabled}
                                            onCheckedChange={(checked) => handleProductChange(provider.id, product.id, { penaltyRulesEnabled: checked })}
                                            className="data-[state=checked]:bg-[--provider-color]"
                                            style={{'--provider-color': provider.colorHex} as React.CSSProperties}
                                        />
                                    </div>
                                    <div>
                                        <div className="space-y-2 p-4 border rounded-md bg-muted/50">
                                            {product.penaltyRules.map((rule, index) => (
                                                <PenaltyRuleRow
                                                    key={rule.id}
                                                    rule={rule}
                                                    onChange={(updatedRule) => handleProductChange(provider.id, product.id, {
                                                        penaltyRules: produce(product.penaltyRules, draft => {
                                                            draft[index] = updatedRule;
                                                        })
                                                    })}
                                                    onRemove={() => handleRemovePenaltyRule(provider.id, product.id, rule.id)}
                                                    color={provider.colorHex}
                                                    isEnabled={!!product.penaltyRulesEnabled}
                                                />
                                            ))}
                                            <Button variant="outline" size="sm" onClick={() => handleAddPenaltyRule(provider.id, product.id)} disabled={!product.penaltyRulesEnabled}>
                                                <PlusCircle className="h-4 w-4 mr-2" /> Add Penalty Rule
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4">
                                        <LoanTiersForm
                                            product={product}
                                            onUpdate={(updatedProductData) => handleProductChange(provider.id, product.id, updatedProductData)}
                                            color={provider.colorHex}
                                        />
                                    </div>

                               </CardContent>
                               <CardFooter>
                                    <Button 
                                        onClick={() => handleSaveFees(provider.id, product)} 
                                        size="sm"
                                        style={{ backgroundColor: provider.colorHex }}
                                        className="text-white ml-auto"
                                    >
                                        Save Configuration for {product.name}
                                    </Button>
                               </CardFooter>
                           </Card>
                       ))}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}

function DataProvisioningTab({ initialProviders, onUpdateProviders }: {
    initialProviders: LoanProvider[],
    onUpdateProviders: React.Dispatch<React.SetStateAction<LoanProvider[]>>
}) {
    const { currentUser } = useAuth();
    const { toast } = useToast();

    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<DataProvisioningConfig | null>(null);
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [deletingConfigId, setDeletingConfigId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRefs = React.useRef<Record<string, React.RefObject<HTMLInputElement>>>({});

    useEffect(() => {
        if (!selectedProviderId && initialProviders.length > 0) {
            const providerToSelect = currentUser?.providerId ? currentUser.providerId : initialProviders[0].id;
            setSelectedProviderId(providerToSelect);
        }
    }, [initialProviders, selectedProviderId, currentUser]);


    const handleOpenDialog = (config: DataProvisioningConfig | null = null) => {
        setEditingConfig(config);
        setIsConfigDialogOpen(true);
    }
    
    const handleDelete = async (configId: string) => {
        try {
            const response = await fetch(`/api/settings/data-provisioning?id=${configId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete config.');
            }
            onUpdateProviders(produce(draft => {
                const provider = draft.find(p => p.id === selectedProviderId);
                if (provider && provider.dataProvisioningConfigs) {
                    provider.dataProvisioningConfigs = provider.dataProvisioningConfigs.filter(c => c.id !== configId);
                }
            }));
            toast({ title: "Success", description: "Data type deleted successfully." });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: 'destructive' });
        } finally {
            setDeletingConfigId(null);
        }
    };
    
    const handleSaveConfig = async (config: Omit<DataProvisioningConfig, 'providerId'>) => {
        const isEditing = !!config.id;
        const method = isEditing ? 'PUT' : 'POST';
        const endpoint = '/api/settings/data-provisioning';
        const body = { ...config, providerId: selectedProviderId };

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save config.');
            }
            const savedConfig = await response.json();
            onUpdateProviders(produce(draft => {
                const provider = draft.find(p => p.id === selectedProviderId);
                if (provider) {
                    if (!provider.dataProvisioningConfigs) {
                        provider.dataProvisioningConfigs = [];
                    }
                    if (isEditing) {
                        const index = provider.dataProvisioningConfigs.findIndex(c => c.id === savedConfig.id);
                        if (index !== -1) {
                            provider.dataProvisioningConfigs[index] = { ...provider.dataProvisioningConfigs[index], ...savedConfig };
                        }
                    } else {
                        provider.dataProvisioningConfigs.push(savedConfig);
                    }
                }
            }));
            toast({ title: "Success", description: `Data type "${savedConfig.name}" saved successfully.` });
        } catch(error: any) {
            toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    };
    
    const selectedProvider = useMemo(() => initialProviders.find(p => p.id === selectedProviderId), [initialProviders, selectedProviderId]);

    selectedProvider?.dataProvisioningConfigs?.forEach(config => {
        if (!fileInputRefs.current[config.id]) {
            fileInputRefs.current[config.id] = React.createRef<HTMLInputElement>();
        }
    });

    const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>, config: DataProvisioningConfig) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            setIsUploading(true);
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonData.length < 2) throw new Error("Excel file must contain a header row and at least one data row.");

                const headers = jsonData[0] as string[];
                const expectedHeaders = config.columns.map(c => c.name);
                if (headers.length !== expectedHeaders.length || !headers.every((h, i) => h === expectedHeaders[i])) {
                    throw new Error(`Header mismatch. Expected headers: ${expectedHeaders.join(', ')}.`);
                }
                
                const dataRows = jsonData.slice(1);

                // Send to backend
                const formData = new FormData();
                formData.append('file', file);
                formData.append('configId', config.id);
                formData.append('rowCount', String(dataRows.length));

                const response = await fetch('/api/settings/data-provisioning-uploads', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to upload file.');
                }
                
                const newUpload = await response.json();
                
                onUpdateProviders(produce(draft => {
                    const provider = draft.find(p => p.id === selectedProviderId);
                    const cfg = provider?.dataProvisioningConfigs?.find(c => c.id === config.id);
                    if (cfg) {
                        if (!cfg.uploads) cfg.uploads = [];
                        cfg.uploads.unshift(newUpload);
                    }
                }));

                toast({
                    title: 'Upload Successful',
                    description: `File "${file.name}" uploaded and recorded successfully.`,
                });

            } catch (error: any) {
                 toast({
                    title: 'Upload Failed',
                    description: error.message,
                    variant: 'destructive',
                });
            } finally {
                setIsUploading(false);
                if (event.target) event.target.value = '';
            }
        };
        reader.onerror = () => {
            toast({ title: 'Error Reading File', description: 'Could not read the selected file.', variant: 'destructive' });
        };
        reader.readAsBinaryString(file);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Data Provisioning Types</CardTitle>
                            <CardDescription>Define custom data types and their columns for data provisioning.</CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <Select onValueChange={setSelectedProviderId} value={selectedProviderId}>
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Select a provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    {initialProviders.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button onClick={() => handleOpenDialog()}>
                                <PlusCircle className="h-4 w-4 mr-2" /> Add Data Type
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {selectedProvider?.dataProvisioningConfigs?.map(config => (
                        <Card key={config.id} className="mb-4">
                            <CardHeader className="flex flex-row justify-between items-center">
                                 <div>
                                    <CardTitle className="text-lg">{config.name}</CardTitle>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(config)}><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingConfigId(config.id)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                               <h4 className="font-medium mb-2">Columns</h4>
                               <ul className="list-disc pl-5 text-sm text-muted-foreground mb-4">
                                    {config.columns.map(col => <li key={col.id}>{col.name} <span className="text-xs opacity-70">({col.type})</span></li>)}
                               </ul>
                               <Separator />
                               <div className="mt-4">
                                   <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-medium">Upload History</h4>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={isUploading}
                                            onClick={() => fileInputRefs.current[config.id]?.current?.click()}
                                        >
                                            {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Upload className="h-4 w-4 mr-2"/>}
                                            Upload File
                                        </Button>
                                        <input
                                            type="file"
                                            ref={fileInputRefs.current[config.id]}
                                            className="hidden"
                                            accept=".xlsx, .xls"
                                            onChange={(e) => handleExcelUpload(e, config)}
                                        />
                                   </div>
                                   <div className="border rounded-md">
                                       <Table>
                                           <TableHeader>
                                               <TableRow>
                                                   <TableHead>File Name</TableHead>
                                                   <TableHead>Rows</TableHead>
                                                   <TableHead>Uploaded By</TableHead>
                                                   <TableHead>Date</TableHead>
                                               </TableRow>
                                           </TableHeader>
                                           <TableBody>
                                               {config.uploads && config.uploads.length > 0 ? (
                                                   config.uploads.map(upload => (
                                                        <TableRow key={upload.id}>
                                                            <TableCell className="font-medium flex items-center gap-2"><FileClock className="h-4 w-4 text-muted-foreground"/>{upload.fileName}</TableCell>
                                                            <TableCell>{upload.rowCount}</TableCell>
                                                            <TableCell>{upload.uploadedBy}</TableCell>
                                                            <TableCell>{format(new Date(upload.uploadedAt), "yyyy-MM-dd HH:mm")}</TableCell>
                                                        </TableRow>
                                                   ))
                                               ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center text-muted-foreground h-24">No files uploaded yet.</TableCell>
                                                    </TableRow>
                                               )}
                                           </TableBody>
                                       </Table>
                                   </div>
                               </div>
                            </CardContent>
                        </Card>
                    ))}
                    {!selectedProvider?.dataProvisioningConfigs?.length && (
                        <div className="text-center text-muted-foreground py-8">No data types defined for {selectedProvider?.name || 'this provider'}.</div>
                    )}
                </CardContent>
            </Card>

            <DataProvisioningDialog
                isOpen={isConfigDialogOpen}
                onClose={() => setIsConfigDialogOpen(false)}
                onSave={handleSaveConfig}
                config={editingConfig}
            />

            <AlertDialog open={!!deletingConfigId} onOpenChange={() => setDeletingConfigId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the data type. This action may fail if it's currently in use by a loan product.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(deletingConfigId!)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function DataProvisioningDialog({ isOpen, onClose, onSave, config }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: Omit<DataProvisioningConfig, 'providerId'>) => void;
    config: DataProvisioningConfig | null;
}) {
    const [name, setName] = useState('');
    const [columns, setColumns] = useState<DataColumn[]>([]);

    useEffect(() => {
        if (config) {
            setName(config.name);
            setColumns(config.columns);
        } else {
            setName('');
            setColumns([{ id: `col-${Date.now()}`, name: '', type: 'string' }]);
        }
    }, [config, isOpen]);

    const handleColumnChange = (index: number, field: keyof DataColumn, value: string) => {
        setColumns(produce(draft => {
            (draft[index] as any)[field] = value;
        }));
    };

    const addColumn = () => {
        setColumns([...columns, { id: `col-${Date.now()}`, name: '', type: 'string' }]);
    };

    const removeColumn = (index: number) => {
        setColumns(columns.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: config?.id || '', name, columns });
        onClose();
    };

    return (
         <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{config ? 'Edit' : 'Add'} Data Type</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="data-type-name">Data Type Name</Label>
                        <Input id="data-type-name" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div>
                        <Label>Columns</Label>
                        <div className="space-y-2 mt-2">
                            {columns.map((col, index) => (
                                <div key={col.id} className="flex items-center gap-2">
                                    <Input
                                        placeholder="Column Name"
                                        value={col.name}
                                        onChange={e => handleColumnChange(index, 'name', e.target.value)}
                                        required
                                    />
                                    <Select value={col.type} onValueChange={(value: 'string' | 'number' | 'date') => handleColumnChange(index, 'type', value)}>
                                        <SelectTrigger className="w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="string">Text</SelectItem>
                                            <SelectItem value="number">Number</SelectItem>
                                            <SelectItem value="date">Date</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeColumn(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            ))}
                        </div>
                         <Button type="button" variant="outline" size="sm" onClick={addColumn} className="mt-2">
                            <PlusCircle className="h-4 w-4 mr-2" /> Add Column
                        </Button>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function SettingsClient({ initialProviders }: { initialProviders: LoanProvider[]}) {
    const [providers, setProviders] = useState(initialProviders);

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            <Tabs defaultValue="providers" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="providers">Providers & Products</TabsTrigger>
                    <TabsTrigger value="configuration">Fee & Tier Configuration</TabsTrigger>
                    <TabsTrigger value="data-provisioning">Data Provisioning</TabsTrigger>
                </TabsList>
                <TabsContent value="providers">
                    <ProvidersTab providers={providers} />
                </TabsContent>
                <TabsContent value="configuration">
                     <ConfigurationTab initialProviders={providers} onUpdateProviders={setProviders} />
                </TabsContent>
                <TabsContent value="data-provisioning">
                     <DataProvisioningTab initialProviders={providers} onUpdateProviders={setProviders} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
