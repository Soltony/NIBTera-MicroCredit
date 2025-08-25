
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Trash2, Loader2, Edit, ChevronDown, Upload, Settings2, Save, FileClock, ShieldQuestion } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';


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

    const handleSwitchChange = (name: keyof LoanProduct, checked: boolean) => {
        setFormData(prev => ({...prev, [name]: checked }));
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
                    duration: parseInt(String(formData.duration)) || 30,
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
                            onCheckedChange={(checked) => handleSwitchChange('status', checked)}
                            className="data-[state=checked]:bg-[--provider-color]"
                            style={{'--provider-color': providerColor} as React.CSSProperties}
                        />
                        <Label htmlFor={`status-${product.id}`}>{formData.status}</Label>
                    </div>
                     <div className="flex items-center space-x-2 justify-self-end">
                         <Label htmlFor={`allowMultipleLoans-${product.id}`}>Allow multiple active loans</Label>
                         <Switch 
                            id={`allowMultipleLoans-${product.id}`}
                            checked={!!formData.allowMultipleLoans} 
                            onCheckedChange={(checked) => handleSwitchChange('allowMultipleLoans', checked)}
                            className="data-[state=checked]:bg-[--provider-color]"
                            style={{'--provider-color': providerColor} as React.CSSProperties}
                        />
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

function ProvidersTab({ providers, setProviders }: { 
    providers: LoanProvider[],
    setProviders: React.Dispatch<React.SetStateAction<LoanProvider[]>> 
}) {
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

    const handleSaveProvider = async (providerData: Partial<Omit<LoanProvider, 'products' | 'dataProvisioningConfigs'>>) => {
        const isEditing = !!providerData.id;
        const method = isEditing ? 'PUT' : 'POST';
        const endpoint = '/api/settings/providers';
        const body = JSON.stringify(providerData);
        
        try {
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error?.message || `Failed to ${isEditing ? 'update' : 'add'} provider`);
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
                        };
                    }
                } else {
                     draft.push({
                        ...savedProviderResponse,
                        products: [],
                        dataProvisioningConfigs: [],
                    });
                }
            }));

            toast({ title: `Provider ${isEditing ? 'Updated' : 'Added'}`, description: `${isEditing ? providerData.name : savedProviderResponse.name} has been successfully saved.` });
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
                    if (!provider.products) provider.products = [];
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
        {visibleProviders.map((provider) => (
          <AccordionItem value={provider.id} key={provider.id} className="border rounded-lg bg-card">
            <div className="flex items-center w-full p-4">
              <AccordionTrigger className="flex-1 p-0 hover:no-underline text-left" hideChevron>
                <div className="flex items-center gap-4">
                  <IconDisplay iconName={provider.icon} className="h-6 w-6" />
                  <div>
                    <div className="text-lg font-semibold">{provider.name}</div>
                    <p className="text-sm text-muted-foreground">{(provider.products || []).length} products</p>
                  </div>
                </div>
              </AccordionTrigger>
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
                <AccordionTrigger className="p-2">
                  <span className="sr-only">Toggle</span>
                </AccordionTrigger>
              </div>
            </div>
            <AccordionContent className="p-4 border-t">
              <div className="space-y-6">
                {(provider.products || []).map(product => (
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
    </>
    );
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
             <div className="relative flex-1">
                <Input
                    type="number"
                    value={rule.value ?? ''}
                    onChange={(e) => onChange({ ...rule, value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
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
        // Validation and convert to numbers before sending
        const tiersToSend = tiers.map((tier, i) => {
            const fromScore = Number(tier.fromScore);
            const toScore = Number(tier.toScore);
            const loanAmount = Number(tier.loanAmount);

            if (isNaN(fromScore) || isNaN(toScore) || isNaN(loanAmount)) {
                toast({ title: 'Invalid Tier', description: `In tier #${i + 1}, all fields must be valid numbers.`, variant: 'destructive'});
                throw new Error("Invalid tier data");
            }
            if (fromScore > toScore) {
                toast({ title: 'Invalid Tier', description: `In tier #${i + 1}, the "From Score" cannot be greater than the "To Score".`, variant: 'destructive'});
                throw new Error("Invalid tier data");
            }
            if (i > 0) {
                const prevToScore = Number(tiers[i-1].toScore);
                if (fromScore <= prevToScore) {
                    toast({ title: 'Overlapping Tiers', description: `Tier #${i + 1} overlaps with the previous tier. "From Score" must be greater than the previous "To Score".`, variant: 'destructive'});
                    throw new Error("Invalid tier data");
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


        setIsLoading(true);
        try {
            const response = await fetch('/api/settings/loan-amount-tiers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: product.id, tiers: tiersToSend }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save loan tiers.');
            }

            const savedTiers = await response.json();
            onUpdate({ loanAmountTiers: savedTiers });
            
            toast({ title: 'Success', description: 'Loan amount tiers have been saved successfully.' });
        } catch (error: any) {
            // Toast is already shown for validation errors
            if (error.message !== "Invalid tier data") {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
            }
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

// Helper to safely parse JSON fields that might be strings
const safeParseJson = (data: any, field: string, defaultValue: any) => {
    if (data && typeof data[field] === 'string') {
        try {
            return JSON.parse(data[field]);
        } catch (e) {
            return defaultValue;
        }
    }
    return data?.[field] ?? defaultValue;
};


function ProductConfiguration({ product, providerColor, onProductUpdate }: { 
    product: LoanProduct; 
    providerColor?: string;
    onProductUpdate: (updatedProduct: LoanProduct) => void;
}) {
    const { toast } = useToast();

    // Ensure JSON fields are parsed on initialization or when product prop changes
    const parsedProduct = useMemo(() => {
        const serviceFee = safeParseJson(product, 'serviceFee', { type: 'percentage', value: 0 });
        const dailyFee = safeParseJson(product, 'dailyFee', { type: 'percentage', value: 0, calculationBase: 'principal' });
        const penaltyRules = safeParseJson(product, 'penaltyRules', []);
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
            value: 0
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
        try {
            const response = await fetch('/api/settings/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save configuration');
            }
            const savedProduct = await response.json();
            onProductUpdate(savedProduct);
            toast({ title: 'Configuration Saved', description: `Configuration for ${product.name} has been updated.` });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <Card>
            <CardHeader><CardTitle>{config.name}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center justify-between border-b pb-4">
                    <Label htmlFor={`serviceFeeEnabled-${config.id}`} className="font-medium">Service Fee</Label>
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
                    <Label htmlFor={`dailyFeeEnabled-${config.id}`} className="font-medium">Daily Fee</Label>
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
                    <Label htmlFor={`penaltyRulesEnabled-${config.id}`} className="font-medium">Penalty Rules</Label>
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
                >
                    Save Configuration for {config.name}
                </Button>
           </CardFooter>
       </Card>
    );
}


function ConfigurationTab({ providers, onProductUpdate }: { 
    providers: LoanProvider[],
    onProductUpdate: (providerId: string, updatedProduct: LoanProduct) => void;
}) {
    const { currentUser } = useAuth();
    
    const visibleProviders = useMemo(() => {
        if (!currentUser || currentUser.role === 'Super Admin' || currentUser.role === 'Admin') {
            return providers;
        }
        return providers.filter(p => p.id === currentUser.providerId);
    }, [providers, currentUser]);
    
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
                            />
                       ))}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}

function DataProvisioningTab({ providers, setProviders }: {
    providers: LoanProvider[],
    setProviders: React.Dispatch<React.SetStateAction<LoanProvider[]>>
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
        if (!selectedProviderId && providers.length > 0) {
            const providerToSelect = currentUser?.providerId ? currentUser.providerId : providers[0].id;
            setSelectedProviderId(providerToSelect);
        }
    }, [providers, selectedProviderId, currentUser]);


    const handleOpenDialog = (config: DataProvisioningConfig | null = null) => {
        setEditingConfig(config);
        setIsConfigDialogOpen(true);
    };
    
    const handleDelete = async (configId: string) => {
        try {
            const response = await fetch(`/api/settings/data-provisioning?id=${configId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete config.');
            }
            setProviders(produce(draft => {
                const provider = draft.find(p => p.id === selectedProviderId);
                if (provider && provider.dataProvisioningConfigs) {
                    provider.dataProvisioningConfigs = provider.dataProvisioningConfigs.filter(c => c.id !== configId);
                }
            }));
            toast({ title: "Success", description: "Data type deleted successfully." });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setDeletingConfigId(null);
        }
    };
    
    const handleSaveConfig = async (config: Omit<DataProvisioningConfig, 'providerId' | 'id'> & { id?: string }) => {
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
            setProviders(produce(draft => {
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
    
    const selectedProvider = useMemo(() => providers.find(p => p.id === selectedProviderId), [providers, selectedProviderId]);

    selectedProvider?.dataProvisioningConfigs?.forEach(config => {
        if (!fileInputRefs.current[config.id]) {
            fileInputRefs.current[config.id] = React.createRef<HTMLInputElement>();
        }
    });

    const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>, config: DataProvisioningConfig) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                // Here we just pass the file to the backend, which will handle parsing and validation
                const formData = new FormData();
                formData.append('file', file);
                formData.append('configId', config.id);

                const response = await fetch('/api/settings/data-provisioning-uploads', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to upload file.');
                }
                
                const newUpload = await response.json();
                
                setProviders(produce(draft => {
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
             setIsUploading(false);
            toast({ title: 'Error Reading File', description: 'Could not read the selected file.', variant: 'destructive' });
        };
        // This just reads the file for sending, not parsing on client
        reader.readAsArrayBuffer(file);
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
                                    {providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
                                    {(config.columns || []).map(col => <li key={col.id}>{col.name} <span className="text-xs opacity-70">({col.type})</span> {col.isIdentifier && <Badge variant="outline" className="ml-2">ID</Badge>}</li>)}
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
    onSave: (config: Omit<DataProvisioningConfig, 'providerId' | 'id'> & { id?: string }) => void;
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
            setColumns([{ id: `col-${Date.now()}`, name: '', type: 'string', isIdentifier: true, dbField: 'ID' }]);
        }
    }, [config, isOpen]);

    const handleColumnChange = (index: number, field: keyof DataColumn, value: string | boolean) => {
        setColumns(produce(draft => {
            const currentColumn = draft[index];
            if (typeof value === 'boolean' && field === 'isIdentifier') {
                // Ensure only one identifier is selected at a time
                draft.forEach((col, i) => {
                    col.isIdentifier = i === index ? value : false;
                });
            } else {
                (currentColumn as any)[field] = value;
            }
        }));
    };

    const addColumn = () => {
        setColumns([...columns, { id: `col-${Date.now()}`, name: '', type: 'string', isIdentifier: false, dbField: 'ID' }]);
    };

    const removeColumn = (index: number) => {
        setColumns(columns.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Validation: ensure at least one identifier is set
        if (!columns.some(c => c.isIdentifier)) {
            alert('Please mark one column as the customer identifier.');
            return;
        }
        // Ensure the identifier uses the 'ID' dbField
        const identifierColumn = columns.find(c => c.isIdentifier);
        if (identifierColumn && identifierColumn.dbField !== 'ID') {
            alert('The identifier column must use the "Customer ID" database field.');
            return;
        }

        onSave({ id: config?.id, name, columns });
        onClose();
    };

    return (
         <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl">
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
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`is-identifier-${col.id}`}
                                            checked={col.isIdentifier}
                                            onCheckedChange={(checked) => handleColumnChange(index, 'isIdentifier', !!checked)}
                                        />
                                        <Label htmlFor={`is-identifier-${col.id}`} className="text-sm text-muted-foreground">Identifier</Label>
                                    </div>
                                    {col.isIdentifier && (
                                        <Select value={col.dbField} onValueChange={(value: 'ID') => handleColumnChange(index, 'dbField', value)}>
                                            <SelectTrigger className="w-48">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ID">Customer ID</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
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

    const onProductUpdate = useCallback((providerId: string, updatedProduct: LoanProduct) => {
        setProviders(produce(draft => {
            const provider = draft.find(p => p.id === providerId);
            if (provider) {
                const productIndex = provider.products.findIndex(p => p.id === updatedProduct.id);
                if (productIndex !== -1) {
                    provider.products[productIndex] = updatedProduct;
                }
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
                    <TabsTrigger value="data-provisioning">Data Provisioning</TabsTrigger>
                </TabsList>
                <TabsContent value="providers">
                    <ProvidersTab providers={providers} setProviders={setProviders} />
                </TabsContent>
                <TabsContent value="configuration">
                     <ConfigurationTab providers={providers} onProductUpdate={onProductUpdate} />
                </TabsContent>
                <TabsContent value="data-provisioning">
                     <DataProvisioningTab providers={providers} setProviders={setProviders} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
