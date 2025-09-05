

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { PlusCircle, Trash2, Loader2, Edit, ChevronDown, Settings2, Save } from 'lucide-react';
import type { LoanProvider, LoanProduct, FeeRule, PenaltyRule, DataProvisioningConfig, LoanAmountTier, DailyFeeRule, TermsAndConditions } from '@/lib/types';
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
import { useAuth } from '@/hooks/use-auth';
import { produce } from 'immer';
import { IconDisplay } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';


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


const ProductSettingsForm = ({ providerId, product, providerColor, onSave, onDelete }: { 
    providerId: string; 
    product: LoanProduct; 
    providerColor?: string; 
    onSave: (providerId: string, product: LoanProduct) => void;
    onDelete: (providerId: string, productId: string) => void;
}) => {
    const [formData, setFormData] = useState(product);
    const [isSaving, setIsSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
         setFormData({
            ...product,
            serviceFee: safeParseJson(product, 'serviceFee', { type: 'percentage', value: 0 }),
            dailyFee: safeParseJson(product, 'dailyFee', { type: 'percentage', value: 0, calculationBase: 'principal' }),
            penaltyRules: safeParseJson(product, 'penaltyRules', []),
        });
    }, [product]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value === '' ? null : parseFloat(value) }));
    };

    const handleSwitchChange = (name: keyof LoanProduct, checked: boolean) => {
        if (name === 'status') {
            setFormData(prev => ({ ...prev, status: checked ? 'Active' : 'Disabled' }));
        } else {
            setFormData(prev => ({...prev, [name]: checked }));
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const parsedDuration = parseInt(String(formData.duration));
            const payload = {
                ...formData,
                minLoan: parseFloat(String(formData.minLoan)) || 0,
                maxLoan: parseFloat(String(formData.maxLoan)) || 0,
                duration: isNaN(parsedDuration) ? 30 : parsedDuration,
            };

            const response = await fetch('/api/settings/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || 'Failed to save product settings.');
            }
            const savedProduct = await response.json();
            onSave(providerId, savedProduct);
            toast({ title: "Settings Saved", description: `Settings for ${product.name} have been updated.` });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }

    return (
       <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
            <div className="flex items-center justify-between space-x-4 px-4 py-2 border rounded-lg bg-background">
                <h4 className="text-sm font-semibold">{product.name}</h4>
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-9 p-0">
                        <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                        <span className="sr-only">Toggle</span>
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
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
                        <div className="flex items-center space-x-2">
                            <Switch
                                id={`allowConcurrentLoans-${product.id}`}
                                checked={!!formData.allowConcurrentLoans}
                                onCheckedChange={(checked) => handleSwitchChange('allowConcurrentLoans', checked)}
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
                    <div className="flex items-center space-x-2 justify-end mt-6">
                        <Button variant="destructive" type="button" onClick={() => onDelete(providerId, product.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
                        <Button type="submit" style={{ backgroundColor: providerColor }} className="text-white" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </CollapsibleContent>
        </Collapsible>
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
            
            onProvidersChange(produce(draft => {
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

            onProvidersChange(produce(draft => {
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
        onProvidersChange(produce(draft => {
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
            onProvidersChange(prev => prev.filter(p => p.id !== providerId));
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
             onProvidersChange(produce(draft => {
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
            // Validation errors are already toasted. Only toast for server/network errors.
            if (!["Invalid tier data", "Invalid loan amount", "Overlapping Tiers"].includes(error.message)) {
                toast({ title: 'Error Saving Tiers', description: error.message, variant: 'destructive' });
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
        const penaltyRules = safeParseJson(product, 'penaltyRules', []).map((r: any) => ({ ...r, frequency: r.frequency || 'daily' }));
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

function AgreementTab({ provider, onProviderUpdate }: { provider: LoanProvider, onProviderUpdate: (update: Partial<LoanProvider>) => void }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [content, setContent] = useState('');
    const [activeVersion, setActiveVersion] = useState<TermsAndConditions | null>(null);

    useEffect(() => {
        setIsLoading(true);
        fetch(`/api/settings/terms?providerId=${provider.id}`)
            .then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch terms')))
            .then(data => {
                if (data) {
                    setContent(data.content);
                    setActiveVersion(data);
                } else {
                    setContent('');
                    setActiveVersion(null);
                }
            })
            .catch(() => toast({ title: "Error", description: "Could not load agreement.", variant: "destructive" }))
            .finally(() => setIsLoading(false));
    }, [provider.id, toast]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/settings/terms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ providerId: provider.id, content })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save agreement.');
            }
            
            const newVersion = await response.json();
            setActiveVersion(newVersion);
            
            toast({ title: 'Success', description: `New agreement (Version ${newVersion.version}) has been published.` });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
         <Card>
            <CardHeader>
                <CardTitle>Borrower Agreement</CardTitle>
                <CardDescription>
                    Manage the Terms & Conditions for {provider.name}. Saving will publish a new version.
                </CardDescription>
                {activeVersion && (
                     <p className="text-xs text-muted-foreground pt-2">
                        Current active version: <span className="font-semibold">{activeVersion.version}</span> (Published on {new Date(activeVersion.publishedAt).toLocaleDateString()})
                    </p>
                )}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                     <div className="space-y-2">
                        <Skeleton className="h-6 w-1/4" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="agreement-content">Agreement Content</Label>
                        <Textarea 
                            id="agreement-content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={15}
                            placeholder="Enter your terms and conditions here..."
                        />
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSave} style={{ backgroundColor: provider.colorHex }} className="text-white ml-auto" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save & Publish New Version
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


export function SettingsClient({ initialProviders }: { initialProviders: LoanProvider[]}) {
    const [providers, setProviders] = useState(initialProviders);

    const onProductUpdate = useCallback((providerId: string, updatedProduct: LoanProduct) => {
        setProviders(produce(draft => {
            const provider = draft.find(p => p.id === providerId);
            if (provider) {
                const productIndex = provider.products.findIndex(p => p.id === updatedProduct.id);
                if (productIndex !== -1) {
                    // Make sure to preserve the existing loanAmountTiers if they are not in the update
                    const existingTiers = provider.products[productIndex].loanAmountTiers;
                    provider.products[productIndex] = {
                        ...updatedProduct,
                        loanAmountTiers: updatedProduct.loanAmountTiers || existingTiers,
                    };
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
                </TabsList>
                <TabsContent value="providers">
                    <ProvidersTab providers={providers} onProvidersChange={handleProvidersChange} />
                </TabsContent>
                <TabsContent value="configuration">
                     <ConfigurationTab providers={providers} onProductUpdate={onProductUpdate} />
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
            </Tabs>
        </div>
    );
}

    
