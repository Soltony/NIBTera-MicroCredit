
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
import { PlusCircle, Trash2, Loader2, Edit, ChevronDown, Upload, Settings2 } from 'lucide-react';
import type { LoanProvider, LoanProduct, FeeRule, PenaltyRule, DataProvisioningConfig, DataColumn } from '@/lib/types';
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

function ConfigurationTab({ initialProviders, onUpdateProviders }: { 
    initialProviders: LoanProvider[],
    onUpdateProviders: React.Dispatch<React.SetStateAction<LoanProvider[]>>
}) {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const fileInputRefs = React.useRef<Record<string, React.RefObject<HTMLInputElement>>>({});
    
    const visibleProviders = useMemo(() => {
        if (!currentUser || currentUser.role === 'Super Admin' || currentUser.role === 'Admin') {
            return initialProviders;
        }
        return initialProviders.filter(p => p.id === currentUser.providerId);
    }, [initialProviders, currentUser]);

    visibleProviders.forEach(p => {
        if (p.products) {
            p.products.forEach(prod => {
                if (!fileInputRefs.current[prod.id]) {
                    fileInputRefs.current[prod.id] = React.createRef<HTMLInputElement>();
                }
            });
        }
    });

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
                        toDay: Infinity,
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
                                            onCheckedChange={(checked) => handleProductChange(provider.id, product.id, { dataProvisioningEnabled: checked, dataProvisioningConfigId: checked ? product.dataProvisioningConfigId : null })}
                                            className="data-[state=checked]:bg-[--provider-color]"
                                            style={{'--provider-color': provider.colorHex} as React.CSSProperties}
                                        />
                                    </div>
                                    {product.dataProvisioningEnabled && (
                                        <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                                            <div>
                                                <Label className="font-medium text-sm">Data Type</Label>
                                                <Select
                                                    value={product.dataProvisioningConfigId || ''}
                                                    onValueChange={(value) => handleProductChange(provider.id, product.id, { dataProvisioningConfigId: value })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a data type..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {provider.dataProvisioningConfigs?.map(config => (
                                                            <SelectItem key={config.id} value={config.id}>{config.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            
                                            {product.dataProvisioningConfigId && (
                                                <div className="flex items-center justify-between pt-4 border-t">
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
                            provider.dataProvisioningConfigs[index] = savedConfig;
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
                               <ul className="list-disc pl-5 text-sm text-muted-foreground">
                                    {config.columns.map(col => <li key={col.id}>{col.name} <span className="text-xs opacity-70">({col.type})</span></li>)}
                               </ul>
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
                    <TabsTrigger value="configuration">Fee Configuration</TabsTrigger>
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
