
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
import { Building2, Landmark, Briefcase, Home, PersonStanding, PlusCircle, Trash2, Loader2 } from 'lucide-react';
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


// A helper to map string names to actual icon components
const iconMap: { [key: string]: React.ElementType } = {
  Building2,
  Landmark,
  Briefcase,
  Home,
  PersonStanding,
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
    )
}

function ProvidersTab({ initialProviders }: { initialProviders: LoanProvider[] }) {
    const [providers, setProviders] = useState(initialProviders);
    const { currentUser } = useAuth();
    const [isAddProviderDialogOpen, setIsAddProviderDialogOpen] = useState(false);
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
    
    const handleAddProvider = async (newProviderData: Omit<LoanProvider, 'id' | 'products'>) => {
        try {
            const response = await fetch('/api/settings/providers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProviderData)
            });
            if (!response.ok) throw new Error('Failed to add provider');
            const newProvider = await response.json();
            setProviders(prev => [...prev, newProvider]);
            toast({ title: "Provider Added", description: `${newProvider.name} has been added successfully.` });
        } catch (error) {
             toast({ title: "Error", description: "Could not add provider.", variant: 'destructive' });
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
             await fetch(`/api/settings/products?id=${productId}`, { method: 'DELETE' });
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
                <Button onClick={() => setIsAddProviderDialogOpen(true)} style={{ backgroundColor: themeColor }} className="text-white">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Provider
                </Button>
            )}
        </div>
        <Accordion type="multiple" className="w-full space-y-4">
            {visibleProviders.map((provider) => (
                <AccordionItem value={provider.id} key={provider.id} className="border rounded-lg bg-card">
                    <AccordionPrimitive.Header className="flex items-center w-full">
                        <AccordionTrigger className="p-4 hover:no-underline flex-1">
                            <div className="flex items-center gap-4">
                                {React.createElement(iconMap[provider.icon] || Building2, { className: "h-8 w-8 text-muted-foreground", style: { color: provider.colorHex } })}
                                <div>
                                    <h3 className="text-lg font-semibold">{provider.name}</h3>
                                    <p className="text-sm text-muted-foreground">{provider.products.length} products</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        {(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') && (
                            <div className="p-4 pl-0">
                                <Button variant="ghost" size="icon" className="hover:bg-destructive hover:text-destructive-foreground" onClick={(e) => { e.stopPropagation(); setDeletingId({ type: 'provider', providerId: provider.id })}}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </AccordionPrimitive.Header>
                    <AccordionContent className="p-4 border-t">
                        <div className="space-y-6">
                            {provider.products.map(product => (
                                <div key={product.id}>
                                     <h4 className="text-md font-semibold mb-2">{product.name}</h4>
                                     <ProductSettingsForm 
                                        providerId={provider.id}
                                        product={{...product, icon: product.icon || 'PersonStanding'}} 
                                        providerColor={provider.colorHex} 
                                        onSave={handleSaveProduct}
                                        onDelete={() => setDeletingId({ type: 'product', providerId: provider.id, productId: product.id })}
                                     />
                                </div>
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
            isOpen={isAddProviderDialogOpen}
            onClose={() => setIsAddProviderDialogOpen(false)}
            onAddProvider={handleAddProvider as any}
            primaryColor={themeColor}
        />
        <AddProductDialog
            isOpen={isAddProductDialogOpen}
            onClose={() => setIsAddProductDialogOpen(false)}
            onAddProduct={handleAddProduct as any}
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
