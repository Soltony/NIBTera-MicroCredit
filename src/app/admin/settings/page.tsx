
'use client';

import React, { useState, useEffect } from 'react';
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
import { useLoanProviders } from '@/hooks/use-loan-providers';
import { Building2, Landmark, Briefcase, Home, PersonStanding, PlusCircle, Trash2 } from 'lucide-react';
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


const ProductSettingsForm = ({ providerId, product, providerColor, onSave }: { providerId: string; product: LoanProduct, providerColor?: string, onSave: (providerId: string, product: LoanProduct) => void }) => {
    const [formData, setFormData] = useState(product);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updatedProduct: LoanProduct = {
            ...formData,
            minLoan: parseFloat(formData.minLoan as any),
            maxLoan: parseFloat(formData.maxLoan as any),
        };
        onSave(providerId, updatedProduct);
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
                <Label htmlFor={`serviceFee-${product.id}`}>Service Fee (%)</Label>
                <Input id={`serviceFee-${product.id}`} value={formData.serviceFee} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`dailyFee-${product.id}`}>Daily Fee (%)</Label>
                <Input id={`dailyFee-${product.id}`} value={formData.dailyFee} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`penaltyFee-${product.id}`}>Penalty Fee After Due Date</Label>
                <Input id={`penaltyFee-${product.id}`} value={formData.penaltyFee} onChange={handleChange} />
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
                <Button type="submit" style={{ backgroundColor: providerColor }} className="text-white">Save Changes</Button>
            </div>
        </form>
    )
}

export default function AdminSettingsPage() {
    const { providers, addProvider, addProduct, updateProduct } = useLoanProviders();
    const { currentUser } = useAuth();
    const [isAddProviderDialogOpen, setIsAddProviderDialogOpen] = useState(false);
    const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const { toast } = useToast();
    
    const themeColor = React.useMemo(() => {
        if (currentUser?.role === 'Admin') {
            return providers.find(p => p.name === 'NIb Bank')?.colorHex || '#fdb913';
        }
        return providers.find(p => p.name === currentUser?.providerName)?.colorHex || '#fdb913';
    }, [currentUser, providers]);
    
    const handleAddProvider = (newProvider: Omit<LoanProvider, 'id' | 'products'>) => {
        addProvider(newProvider);
        toast({ title: "Provider Added", description: `${newProvider.name} has been added successfully.` });
    };
    
    const handleOpenAddProductDialog = (providerId: string) => {
        setSelectedProviderId(providerId);
        setIsAddProductDialogOpen(true);
    };

    const handleAddProduct = (newProduct: Omit<LoanProduct, 'id' | 'availableLimit' | 'status'>) => {
        if (!selectedProviderId) return;
        addProduct(selectedProviderId, newProduct);
        toast({ title: "Product Added", description: `${newProduct.name} has been added successfully.` });
    };

    const handleSaveProduct = (providerId: string, product: LoanProduct) => {
        updateProduct(providerId, product);
        toast({ title: "Settings Saved", description: `Changes to ${product.name} have been saved.` });
    }
    
    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Loan Settings</h2>
                     <Button onClick={() => setIsAddProviderDialogOpen(true)} style={{ backgroundColor: themeColor }} className="text-white">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Provider
                    </Button>
                </div>
                <Accordion type="multiple" className="w-full space-y-4">
                    {providers.map((provider) => (
                        <AccordionItem value={provider.id} key={provider.id} className="border rounded-lg bg-card">
                            <AccordionTrigger className="p-4 hover:no-underline">
                                <div className="flex items-center gap-4">
                                    <provider.icon className="h-8 w-8 text-muted-foreground" style={{ color: provider.colorHex }} />
                                    <div>
                                        <h3 className="text-lg font-semibold">{provider.name}</h3>
                                        <p className="text-sm text-muted-foreground">{provider.products.length} products</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 border-t">
                                <div className="space-y-6">
                                    {provider.products.map(product => (
                                        <div key={product.id}>
                                             <h4 className="text-md font-semibold mb-2">{product.name}</h4>
                                             <ProductSettingsForm 
                                                providerId={provider.id}
                                                product={product} 
                                                providerColor={provider.colorHex} 
                                                onSave={handleSaveProduct}
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
            </div>
            <AddProviderDialog
                isOpen={isAddProviderDialogOpen}
                onClose={() => setIsAddProviderDialogOpen(false)}
                onAddProvider={handleAddProvider}
                primaryColor={themeColor}
            />
            <AddProductDialog
                isOpen={isAddProductDialogOpen}
                onClose={() => setIsAddProductDialogOpen(false)}
                onAddProduct={handleAddProduct}
            />
        </>
    );
}
