
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
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
import { Building2, Landmark, Briefcase, Home, PersonStanding, PlusCircle, Trash2, Loader2, Edit, ChevronDown } from 'lucide-react';
import type { LoanProvider, LoanProduct } from '@/lib/types';
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
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { getCustomIcon } from '@/lib/types';
import { AccordionTrigger } from '../ui/accordion';


// A helper to map string names to actual icon components
const iconMap: { [key: string]: React.ElementType } = {
  Building2,
  Landmark,
  Briefcase,
  Home,
  PersonStanding,
};

const IconDisplay = ({ iconName, className }: { iconName: string; className?: string; }) => {
    const isCustom = typeof iconName === 'string' && iconName.startsWith('custom-icon-');
    const [customIconSrc, setCustomIconSrc] = useState<string | null>(null);

    useEffect(() => {
        if (isCustom) {
            const src = getCustomIcon(iconName);
            setCustomIconSrc(src);
        }
    }, [iconName, isCustom]);

    if (isCustom) {
        return customIconSrc ? <img src={customIconSrc} alt="Custom Icon" className={cn("h-6 w-6", className)} /> : <div className={cn("h-6 w-6", className)} />;
    }

    const IconComponent = iconMap[iconName] || Building2;
    return <IconComponent className={cn("h-6 w-6", className)} />;
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
    const { toast } = useToast();

    useEffect(() => {
        setFormData(product);
    }, [product]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        const key = id.split('-')[0];
        setFormData(prev => ({ ...prev, [key]: value }));
    }

    const handleSwitchChange = (checked: boolean) => {
        setFormData(prev => ({...prev, status: checked ? 'Active' : 'Disabled' }));
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const updatedProduct: LoanProduct = {
            ...formData,
            minLoan: parseFloat(formData.minLoan as any),
            maxLoan: parseFloat(formData.maxLoan as any),
        };
        try {
            const response = await fetch('/api/settings/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProduct),
            });
            if (!response.ok) throw new Error('Failed to save product');
            onSave(providerId, updatedProduct);
            toast({ title: "Settings Saved", description: `Changes to ${product.name} have been saved.` });
        } catch (error) {
            toast({ title: "Error", description: "Could not save product settings.", variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="text-md font-semibold">{product.name}</div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-background">
                <div className="space-y-2">
                    <Label htmlFor={`minLoan-${product.id}`}>Minimum Loan Amount</Label>
                    <Input id={`minLoan-${product.id}`} type="number" value={formData.minLoan} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`maxLoan-${product.id}`}>Maximum Loan Amount</Label>
                    <Input id={`maxLoan-${product.id}`} type="number" value={formData.maxLoan} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`serviceFee-${product.id}`}>Service Fee</Label>
                    <Input id={`serviceFee-${product.id}`} value={formData.serviceFee} onChange={handleChange} placeholder="e.g. 3%"/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`dailyFee-${product.id}`}>Daily Fee</Label>
                    <Input id={`dailyFee-${product.id}`} value={formData.dailyFee} onChange={handleChange} placeholder="e.g. 0.2%"/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`penaltyFee-${product.id}`}>Penalty Fee After Due Date</Label>
                    <Input id={`penaltyFee-${product.id}`} value={formData.penaltyFee} onChange={handleChange} placeholder="e.g. 0.11% daily" />
                </div>
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
                 <div className="flex items-center space-x-2 md:col-span-2 justify-end">
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

function ProvidersTab({ initialProviders }: { initialProviders: LoanProvider[] }) {
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
            if (!response.ok) throw new Error(`Failed to ${isEditing ? 'update' : 'add'} provider`);
            
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
        } catch (error) {
             toast({ title: "Error", description: `Could not ${isEditing ? 'update' : 'add'} provider.`, variant: 'destructive' });
        }
    };
    
    const handleOpenAddProductDialog = (providerId: string) => {
        setSelectedProviderId(providerId);
        setIsAddProductDialogOpen(true);
    };

    const handleAddProduct = async (newProductData: Omit<LoanProduct, 'id' | 'status'>) => {
        if (!selectedProviderId) return;

        try {
             const response = await fetch('/api/settings/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newProductData, providerId: selectedProviderId })
            });
            if (!response.ok) throw new Error('Failed to add product');
            const newProduct = await response.json();

            setProviders(produce(draft => {
                const provider = draft.find(p => p.id === selectedProviderId);
                if (provider) {
                    provider.products.push(newProduct);
                }
            }));
            toast({ title: "Product Added", description: `${newProduct.name} has been added successfully.` });
        } catch (error) {
             toast({ title: "Error", description: "Could not add product.", variant: 'destructive' });
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
            await fetch(`/api/settings/providers?id=${providerId}`, { method: 'DELETE' });
            setProviders(providers.filter(p => p.id !== providerId));
            toast({ title: "Provider Deleted" });
        } catch (error) {
            toast({ title: "Error", description: "Could not delete provider.", variant: 'destructive' });
        }
    }
    
    const handleDeleteProduct = async (providerId: string, productId: string) => {
        try {
             await fetch('/api/settings/products', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId }),
             });
             setProviders(produce(draft => {
                const provider = draft.find(p => p.id === providerId);
                if (provider) {
                    provider.products = provider.products.filter(p => p.id !== productId);
                }
            }));
            toast({ title: "Product Deleted" });
        } catch (error) {
             toast({ title: "Error", description: "Could not delete product.", variant: 'destructive' });
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
                        <AccordionTrigger className="flex-1 p-0 hover:no-underline text-left">
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
                        This action cannot be undone. This will permanently delete the selected item and all of its related data.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
}

export function SettingsClient({ initialProviders }: { initialProviders: LoanProvider[] }) {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            <div className="space-y-4">
                <ProvidersTab initialProviders={initialProviders} />
            </div>
        </div>
    );
}

    

    

    