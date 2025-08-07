
'use client';

import React, { useState } from 'react';
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
import { Building2, Landmark, Briefcase, Home, PersonStanding, PlusCircle } from 'lucide-react';
import type { LoanProvider, LoanProduct } from '@/lib/types';
import { AddProviderDialog } from '@/components/loan/add-provider-dialog';
import { AddProductDialog } from '@/components/loan/add-product-dialog';


const ProductSettingsForm = ({ product, providerColor }: { product: LoanProduct, providerColor?: string }) => {
    return (
        <form className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-background">
            <div className="space-y-2">
                <Label htmlFor={`min-loan-${product.id}`}>Minimum Loan Amount</Label>
                <Input id={`min-loan-${product.id}`} type="number" defaultValue={product.minLoan} />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`max-loan-${product.id}`}>Maximum Loan Amount</Label>
                <Input id={`max-loan-${product.id}`} type="number" defaultValue={product.maxLoan} />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`service-fee-${product.id}`}>Service Fee (%)</Label>
                <Input id={`service-fee-${product.id}`} defaultValue={product.serviceFee} />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`daily-fee-${product.id}`}>Daily Fee (%)</Label>
                <Input id={`daily-fee-${product.id}`} defaultValue={product.dailyFee} />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`penalty-fee-${product.id}`}>Penalty Fee After Due Date</Label>
                <Input id={`penalty-fee-${product.id}`} defaultValue={product.penaltyFee} />
            </div>
             <div className="flex items-center space-x-2 md:col-span-2 justify-end">
                <Button variant="outline">Cancel</Button>
                <Button style={{ backgroundColor: providerColor }} className="text-white">Save Changes</Button>
            </div>
        </form>
    )
}

export default function AdminSettingsPage() {
    const { providers, addProvider, addProduct } = useLoanProviders();
    const [isAddProviderDialogOpen, setIsAddProviderDialogOpen] = useState(false);
    const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const nibBankColor = providers.find(p => p.name === 'NIb Bank')?.colorHex;
    
    const handleAddProvider = (newProvider: Omit<LoanProvider, 'id' | 'products'>) => {
        addProvider(newProvider);
    };
    
    const handleOpenAddProductDialog = (providerId: string) => {
        setSelectedProviderId(providerId);
        setIsAddProductDialogOpen(true);
    };

    const handleAddProduct = (newProduct: Omit<LoanProduct, 'id' | 'availableLimit'>) => {
        if (!selectedProviderId) return;
        addProduct(selectedProviderId, newProduct);
    };

    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Loan Settings</h2>
                     <Button onClick={() => setIsAddProviderDialogOpen(true)} style={{ backgroundColor: nibBankColor }} className="text-white">
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
                                             <ProductSettingsForm product={product} providerColor={provider.colorHex} />
                                        </div>
                                    ))}
                                    <Button variant="outline" className="w-full" onClick={() => handleOpenAddProductDialog(provider.id)}>
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
            />
            <AddProductDialog
                isOpen={isAddProductDialogOpen}
                onClose={() => setIsAddProductDialogOpen(false)}
                onAddProduct={handleAddProduct}
            />
        </>
    );
}
