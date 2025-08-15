

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlusCircle, Trash2, Loader2, Edit, ChevronDown, Upload, Save, History } from 'lucide-react';
import type { LoanProvider, LoanProduct, FeeRule, PenaltyRule, ScoringParameter, Rule } from '@/lib/types';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth';
import { produce } from 'immer';
import { IconDisplay } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScorePreview } from '@/components/loan/score-preview';
import { format } from 'date-fns';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export interface ScoringHistoryItem {
    id: string;
    savedAt: Date;
    parameters: ScoringParameter[];
    appliedProducts: { name: string }[];
}

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
        setFormData(prev => ({ ...prev, [name]: value === '' ? '' : parseFloat(value) }));
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

    const handleAddProduct = async (newProductData: Omit<LoanProduct, 'id' | 'status' | 'serviceFee' | 'dailyFee' | 'penaltyRules'> & { icon?: string }) => {
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

const FeeInput = ({ label, fee, onChange, color, isEnabled }: { label: string; fee: FeeRule; onChange: (fee: FeeRule) => void; color?: string; isEnabled: boolean; }) => {
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
                onChange={(e) => onChange({...rule, toDay: e.target.value === '' ? Infinity : parseInt(e.target.value)})}
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

function ConfigurationTab({ initialProviders }: { initialProviders: LoanProvider[] }) {
    const [providers, setProviders] = useState(initialProviders);
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const fileInputRefs = React.useRef<Record<string, React.RefObject<HTMLInputElement>>>({});
    
    const visibleProviders = useMemo(() => {
        if (!currentUser || currentUser.role === 'Super Admin' || currentUser.role === 'Admin') {
            return providers;
        }
        return providers.filter(p => p.id === currentUser.providerId);
    }, [providers, currentUser]);

    visibleProviders.forEach(p => {
        p.products.forEach(prod => {
            if (!fileInputRefs.current[prod.id]) {
                fileInputRefs.current[prod.id] = React.createRef<HTMLInputElement>();
            }
        });
    });

    const handleProductChange = (providerId: string, productId: string, updatedProduct: Partial<LoanProduct>) => {
        setProviders(produce(draft => {
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
        setProviders(produce(draft => {
             const provider = draft.find(p => p.id === providerId);
            if (provider) {
                const product = provider.products.find(p => p.id === productId);
                if (product) {
                    product.penaltyRules.push({
                        id: `penalty-${Date.now()}`,
                        fromDay: 1,
                        toDay: Infinity,
                        type: 'fixed',
                        value: 0
                    });
                }
            }
        }));
    };
    
    const handleRemovePenaltyRule = (providerId: string, productId: string, ruleId: string) => {
        setProviders(produce(draft => {
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
                body: JSON.stringify(product)
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
    
    const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    console.log('Uploaded Excel Data:', json);
                    toast({
                        title: 'File Uploaded',
                        description: `Successfully parsed ${json.length} rows from the Excel file. Check the console for the data.`,
                    });
                } catch (error) {
                     toast({
                        title: 'Error Parsing File',
                        description: 'There was an issue reading the Excel file. Please ensure it is a valid format.',
                        variant: 'destructive',
                    });
                }
            };
            reader.onerror = () => {
                toast({
                    title: 'Error Reading File',
                    description: 'Could not read the selected file.',
                    variant: 'destructive',
                });
            };
            reader.readAsBinaryString(file);
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
                                <p className="text-sm text-muted-foreground">{provider.products.length} products to configure</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border-t space-y-6">
                       {provider.products.map(product => (
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
                                        color={provider.colorHex}
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
                                     <FeeInput 
                                        label="Fee Details"
                                        fee={product.dailyFee}
                                        onChange={(fee) => handleProductChange(provider.id, product.id, { dailyFee: fee })}
                                        color={provider.colorHex}
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
                                    
                                    <div className="flex items-center justify-between border-b pb-4 pt-4">
                                        <Label htmlFor={`dataProvisioningEnabled-${product.id}`} className="font-medium">Data Provisioning</Label>
                                        <Switch 
                                            id={`dataProvisioningEnabled-${product.id}`}
                                            checked={!!product.dataProvisioningEnabled}
                                            onCheckedChange={(checked) => handleProductChange(provider.id, product.id, { dataProvisioningEnabled: checked })}
                                            className="data-[state=checked]:bg-[--provider-color]"
                                            style={{'--provider-color': provider.colorHex} as React.CSSProperties}
                                        />
                                    </div>
                                    {product.dataProvisioningEnabled && (
                                        <div className="p-4 border rounded-lg bg-muted/50 flex items-center justify-between">
                                            <p className="text-sm text-muted-foreground">Upload data for this loan product.</p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => fileInputRefs.current[product.id]?.current?.click()}
                                            >
                                                <Upload className="h-4 w-4 mr-2"/>
                                                Upload from Excel
                                            </Button>
                                            <input
                                                type="file"
                                                ref={fileInputRefs.current[product.id]}
                                                className="hidden"
                                                accept=".xlsx, .xls"
                                                onChange={handleExcelUpload}
                                            />
                                        </div>
                                    )}

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

const validateRule = (rule: Rule): string | null => {
    if (!rule.field.trim()) {
        return 'The "Field" name cannot be empty.';
    }
    if (rule.condition === 'between') {
        const parts = rule.value?.split('-') || [];
        const min = parts[0]?.trim();
        const max = parts[1]?.trim();
        if (!min || !max) {
            return 'For the "between" condition, both a minimum and maximum value are required.';
        }
        if (isNaN(parseFloat(min)) || isNaN(parseFloat(max))) {
             return 'The "between" condition requires numeric min/max values.';
        }
         if (parseFloat(min) >= parseFloat(max)) {
            return 'The minimum value must be less than the maximum value.';
        }
    } else {
        if (!rule.value.trim()) {
            return 'The "Value" cannot be empty.';
        }
    }
    return null;
}

const AVAILABLE_FIELDS = [
    { value: 'age', label: 'Age' },
    { value: 'monthlyIncome', label: 'Monthly Income' },
    { value: 'gender', label: 'Gender' },
    { value: 'educationLevel', label: 'Education Level' },
    { value: 'totalLoans', label: 'Total Loans' },
    { value: 'onTimeRepayments', label: 'On-Time Repayments' },
];

const RuleRow = ({ rule, onUpdate, onRemove, color }: { rule: Rule; onUpdate: (updatedRule: Rule) => void; onRemove: () => void; color?: string; }) => {
    
    const [min, max] = useMemo(() => {
        const parts = (rule.value || '').split('-');
        return [parts[0] || '', parts[1] || ''];
    }, [rule.value]);

    const handleRangeChange = (part: 'min' | 'max') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const currentMin = part === 'min' ? value : min;
        const currentMax = part === 'max' ? value : max;
        onUpdate({ ...rule, value: `${currentMin}-${currentMax}` });
    }
    
    const error = validateRule(rule);
    
    return (
        <div className="flex flex-col gap-2 p-2 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2">
                <Select value={rule.field} onValueChange={(value) => onUpdate({ ...rule, field: value })}>
                    <SelectTrigger className={cn("w-1/4", !rule.field.trim() && 'border-destructive')}>
                        <SelectValue placeholder="Select Field" />
                    </SelectTrigger>
                    <SelectContent>
                        {AVAILABLE_FIELDS.map(field => (
                            <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={rule.condition} onValueChange={(value) => onUpdate({...rule, condition: value})}>
                    <SelectTrigger className="w-1/4">
                        <SelectValue placeholder="Condition" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value=">">&gt;</SelectItem>
                        <SelectItem value="<">&lt;</SelectItem>
                        <SelectItem value=">=">&gt;=</SelectItem>
                        <SelectItem value="<=">&lt;=</SelectItem>
                        <SelectItem value="==">==</SelectItem>
                        <SelectItem value="!=">!=</SelectItem>
                        <SelectItem value="between">Between</SelectItem>
                    </SelectContent>
                </Select>

                {rule.condition === 'between' ? (
                    <div className="flex items-center gap-2 w-1/4">
                        <Input
                            placeholder="Min"
                            value={min}
                            onChange={handleRangeChange('min')}
                            className={cn((!min.trim() || (!!max.trim() && parseFloat(min) >= parseFloat(max))) && 'border-destructive')}
                        />
                        <span>-</span>
                        <Input
                            placeholder="Max"
                            value={max}
                            onChange={handleRangeChange('max')}
                            className={cn((!max.trim() || (!!min.trim() && parseFloat(min) >= parseFloat(max))) && 'border-destructive')}
                        />
                    </div>
                ) : (
                    <Input
                        placeholder="e.g., 30"
                        value={rule.value || ''}
                        onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                        className={cn("w-1/4", !rule.value.trim() && 'border-destructive')}
                    />
                )}
                
                <Input
                    type="number"
                    placeholder="Score"
                    value={rule.score}
                    onChange={(e) => onUpdate({ ...rule, score: parseInt(e.target.value) || 0 })}
                    className="w-1/4"
                />
                <Button variant="ghost" size="icon" onClick={onRemove} style={{ color: color }} className="hover:text-white hover:bg-destructive">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
             {error && <p className="text-xs text-destructive px-1">{error}</p>}
        </div>
    );
};

function ParametersTab({ providers, initialScoringParameters }: { providers: LoanProvider[], initialScoringParameters: ScoringParameter[] }) {
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [parameters, setParameters] = useState<ScoringParameter[]>(initialScoringParameters);
    const [isLoading, setIsLoading] = useState(false);
    const [deletingParameterId, setDeletingParameterId] = useState<string | null>(null);
    const { toast } = useToast();
    const [appliedProductIds, setAppliedProductIds] = useState<string[]>([]);
    const [history, setHistory] = useState<ScoringHistoryItem[]>([]);

    useEffect(() => {
        if (providers.length > 0 && !selectedProviderId) {
            setSelectedProviderId(providers[0].id);
        }
    }, [providers, selectedProviderId]);

    const currentParametersForProvider = useMemo(() => {
        return parameters.filter(p => p.providerId === selectedProviderId);
    }, [parameters, selectedProviderId]);

    const selectedProvider = useMemo(() => providers.find(p => p.id === selectedProviderId), [providers, selectedProviderId]);
    const themeColor = selectedProvider?.colorHex || '#fdb913';
    
    useEffect(() => {
        const fetchHistory = async () => {
            if (!selectedProviderId) return;
            try {
                const response = await fetch(`/api/scoring-history?providerId=${selectedProviderId}`);
                if (!response.ok) throw new Error('Failed to fetch history');
                const data = await response.json();
                setHistory(data.map((item: any) => ({ ...item, savedAt: new Date(item.savedAt) })));
            } catch (error) {
                toast({ title: "Error", description: "Could not fetch configuration history.", variant: "destructive" });
            }
        };
        fetchHistory();
    }, [selectedProviderId, toast]);

    const totalWeight = React.useMemo(() => {
        if (!currentParametersForProvider) return 0;
        return currentParametersForProvider.reduce((sum, param) => sum + param.weight, 0);
    }, [currentParametersForProvider]);

    const handleSave = async () => {
        if (!selectedProviderId || !currentParametersForProvider) return;

        for (const param of currentParametersForProvider) {
            for (const rule of param.rules) {
                const error = validateRule(rule);
                if (error) {
                    toast({
                        title: 'Invalid Rule',
                        description: `Cannot save. Please fix the error in the "${param.name}" parameter: ${error}`,
                        variant: 'destructive',
                    });
                    return;
                }
            }
        }
        
        if (totalWeight > 100) {
            toast({
                title: 'Invalid Configuration',
                description: 'The total weight of all parameters cannot exceed 100%.',
                variant: 'destructive',
            });
            return;
        }
        
        setIsLoading(true);
        try {
            const saveParamsPromise = fetch('/api/scoring-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ providerId: selectedProviderId, parameters: currentParametersForProvider }),
            });

            const saveHistoryPromise = fetch('/api/scoring-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    providerId: selectedProviderId,
                    parameters: currentParametersForProvider,
                    appliedProductIds: appliedProductIds
                }),
            });

            const [paramsResponse, historyResponse] = await Promise.all([saveParamsPromise, saveHistoryPromise]);

            if (!paramsResponse.ok) {
                const errorData = await paramsResponse.json();
                throw new Error(errorData.error || 'Failed to save parameters.');
            }
             if (!historyResponse.ok) {
                const errorData = await historyResponse.json();
                throw new Error(errorData.error || 'Failed to save history.');
            }

            const savedParameters = await paramsResponse.json();
            const newHistoryItem = await historyResponse.json();
            
            setParameters(produce(parameters, draft => {
                const otherProviderParams = draft.filter(p => p.providerId !== selectedProviderId);
                return [...otherProviderParams, ...savedParameters];
            }));
            
            setHistory(prev => [
                { ...newHistoryItem, savedAt: new Date(newHistoryItem.savedAt) }, 
                ...prev
            ].slice(0, 5));
            
            if (totalWeight < 100) {
                toast({
                    title: 'Configuration Warning',
                    description: `The total weight is ${totalWeight}%, which is less than 100%. The configuration is saved but may not be optimal.`,
                    variant: 'default',
                });
            } else {
                 toast({
                    title: 'Configuration Saved',
                    description: 'Your credit scoring engine parameters have been successfully saved.',
                });
            }

        } catch (error: any) {
             toast({
                title: 'Error Saving',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateParameter = (paramId: string, updatedData: Partial<ScoringParameter>) => {
        setParameters(produce(draft => {
            const paramIndex = draft.findIndex(p => p.id === paramId);
            if (paramIndex !== -1) {
                draft[paramIndex] = { ...draft[paramIndex], ...updatedData };
            }
        }));
    };

    const handleAddParameter = () => {
        if (!selectedProviderId) return;
        const newParam: ScoringParameter = {
            id: `param-${Date.now()}`,
            providerId: selectedProviderId,
            name: 'New Parameter',
            weight: 10,
            rules: [{ id: `rule-${Date.now()}`, field: '', condition: '>', value: '', score: 10 }],
        };
        setParameters([...parameters, newParam]);
    };

    const handleRemoveParameter = (paramId: string) => {
        setParameters(parameters.filter(p => p.id !== paramId));
        setDeletingParameterId(null);
    };

    const handleAddRule = (paramId: string) => {
         const newRule: Rule = {
            id: `rule-${Date.now()}`,
            field: '',
            condition: '>',
            value: '',
            score: 0,
        };
        setParameters(produce(parameters, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                param.rules.push(newRule);
            }
        }));
    }

    const handleUpdateRule = (paramId: string, ruleId: string, updatedRule: Rule) => {
        setParameters(produce(parameters, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                const ruleIndex = param.rules.findIndex(r => r.id === ruleId);
                if (ruleIndex !== -1) {
                    param.rules[ruleIndex] = updatedRule;
                }
            }
        }));
    }

    const handleRemoveRule = (paramId: string, ruleId: string) => {
        setParameters(produce(parameters, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                param.rules = param.rules.filter(r => r.id !== ruleId);
            }
        }));
    }

    const handleLoadHistory = (historyItem: ScoringHistoryItem) => {
        const otherProviderParams = parameters.filter(p => p.providerId !== selectedProviderId);
        setParameters([...otherProviderParams, ...historyItem.parameters]);

        toast({
            title: 'Configuration Loaded',
            description: `Loaded configuration saved on ${format(historyItem.savedAt, 'PPP p')}.`,
        });
    };

    const handleProductSelectionChange = (productId: string, isChecked: boolean) => {
        setAppliedProductIds(prev =>
            isChecked ? [...prev, productId] : prev.filter(id => id !== productId)
        );
    };

    return (
        <div className="space-y-4">
             <div className="flex items-center justify-between">
                <div>
                     <p className="text-muted-foreground">
                        Define parameters and rules to calculate credit scores for the selected provider.
                    </p>
                </div>
                 <div className="flex items-center space-x-4">
                     <Select onValueChange={setSelectedProviderId} value={selectedProviderId}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                        <SelectContent>
                            {providers.map(provider => (
                                <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Total Weight:</span>
                        <span className={`text-lg font-bold ${totalWeight > 100 ? 'text-red-500' : ''}`}>
                            {totalWeight}%
                        </span>
                    </div>
                    <Button onClick={handleSave} style={{ backgroundColor: themeColor }} className="text-white" disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Configuration
                    </Button>
                    <Button onClick={handleAddParameter} style={{ backgroundColor: themeColor }} className="text-white">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Parameter
                    </Button>
                </div>
            </div>

            {selectedProvider && (
                <Card>
                    <CardHeader>
                        <CardTitle>Applied Products</CardTitle>
                        <CardDescription>Select which products from {selectedProvider.name} this scoring model applies to.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {selectedProvider.products.map((product: LoanProduct) => (
                            <div key={product.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`product-${product.id}`}
                                    onCheckedChange={(checked) => handleProductSelectionChange(product.id, !!checked)}
                                    style={{'--primary': themeColor} as React.CSSProperties}
                                    className="border-[--primary] data-[state=checked]:bg-[--primary] data-[state=checked]:border-[--primary]"
                                />
                                <Label htmlFor={`product-${product.id}`} className="font-normal">{product.name}</Label>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <div className="space-y-4 mt-4">
                {currentParametersForProvider.map((param) => (
                    <Card key={param.id}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex items-center gap-4 w-full">
                                <Input
                                    placeholder="Parameter Name"
                                    value={param.name}
                                    onChange={(e) => handleUpdateParameter(param.id, { name: e.target.value })}
                                    className="text-lg font-semibold w-1/3"
                                />
                                <div className="flex items-center gap-2">
                                     <Label>Weight:</Label>
                                     <Input
                                        type="number"
                                        placeholder="%"
                                        value={param.weight}
                                        onChange={(e) => handleUpdateParameter(param.id, { weight: parseInt(e.target.value) || 0 })}
                                        className="w-20"
                                    />
                                </div>
                            </div>
                             <AlertDialog open={deletingParameterId === param.id} onOpenChange={(isOpen) => !isOpen && setDeletingParameterId(null)}>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={() => setDeletingParameterId(param.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the &quot;{param.name}&quot; parameter and all of its rules.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleRemoveParameter(param.id)} style={{ backgroundColor: themeColor }} className="text-white">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible>
                                <AccordionItem value="rules">
                                    <AccordionTrigger>Manage Rules</AccordionTrigger>
                                    <AccordionContent className="space-y-2">
                                        <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                                            <Label className="w-1/4">Field</Label>
                                            <Label className="w-1/4">Condition</Label>
                                            <Label className="w-1/4">Value</Label>
                                            <Label className="w-1/4">Score</Label>
                                        </div>
                                        {param.rules.map((rule) => (
                                           <RuleRow
                                                key={rule.id}
                                                rule={rule}
                                                onUpdate={(updatedRule) => handleUpdateRule(param.id, rule.id, updatedRule)}
                                                onRemove={() => handleRemoveRule(param.id, rule.id)}
                                                color={themeColor}
                                           />
                                        ))}
                                         <Button
                                            variant="outline"
                                            className="mt-2 w-full text-white"
                                            onClick={() => handleAddRule(param.id)}
                                            style={{ backgroundColor: themeColor }}
                                         >
                                            <PlusCircle className="mr-2 h-4 w-4" /> Add Rule
                                        </Button>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                ))}
            </div>

             <Card>
                <CardHeader>
                    <CardTitle>Configuration History</CardTitle>
                    <CardDescription>
                        Previously saved versions of this provider&apos;s scoring configuration.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {history.length > 0 ? (
                        history.map((item) => (
                            <Card key={item.id} className="flex items-center justify-between p-3 bg-muted/50">
                                <div>
                                    <p className="font-medium">
                                        Saved on: {format(new Date(item.savedAt), 'PPP p')}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Applied to: {item.appliedProducts.map(p => p.name).join(', ') || 'None'}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleLoadHistory(item)}
                                >
                                    <History className="mr-2 h-4 w-4" />
                                    Load
                                </Button>
                            </Card>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No history found. Save the configuration to create a snapshot.
                        </p>
                    )}
                </CardContent>
             </Card>

             <ScorePreview parameters={currentParametersForProvider} providerColor={themeColor} />
        </div>
    );
}

export function SettingsClient({ initialProviders, initialScoringParameters }: { initialProviders: LoanProvider[], initialScoringParameters: ScoringParameter[] }) {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            <Tabs defaultValue="providers" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="providers">Providers & Products</TabsTrigger>
                    <TabsTrigger value="configuration">Fee Configuration</TabsTrigger>
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                </TabsList>
                <TabsContent value="providers">
                    <ProvidersTab providers={initialProviders} />
                </TabsContent>
                <TabsContent value="configuration">
                     <ConfigurationTab initialProviders={initialProviders} />
                </TabsContent>
                 <TabsContent value="parameters">
                    <ParametersTab providers={initialProviders} initialScoringParameters={initialScoringParameters} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
