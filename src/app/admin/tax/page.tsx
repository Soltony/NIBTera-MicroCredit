'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, PlusCircle, Trash2 } from 'lucide-react';
import type { Tax as TaxConfig } from '@prisma/client';
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

const TAX_COMPONENTS = [
    { id: 'serviceFee', label: 'Service Fee' },
    { id: 'interest', label: 'Daily Fee (Interest)' },
    { id: 'penalty', label: 'Penalty' },
];

function TaxCard({ tax, onSave, onDelete }: { tax: TaxConfig; onSave: (tax: TaxConfig) => void; onDelete: (taxId: string) => void; }) {
    const [config, setConfig] = useState(tax);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        setConfig(tax);
    }, [tax]);

    const handleComponentChange = (componentId: string, checked: boolean) => {
        const currentAppliedTo = JSON.parse(config.appliedTo);
        const newAppliedTo = checked
            ? [...currentAppliedTo, componentId]
            : currentAppliedTo.filter((c: string) => c !== componentId);
        
        setConfig(prev => ({ ...prev, appliedTo: JSON.stringify(newAppliedTo) }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const numericRate = Number(config.rate);
            if (isNaN(numericRate) || numericRate < 0) {
                toast({ title: 'Invalid Rate', description: 'Tax rate must be a positive number.', variant: 'destructive'});
                return;
            }
            await onSave({ ...config, rate: numericRate });
            toast({ title: 'Success', description: 'Tax configuration has been saved.' });
        } catch (error) {
            // onSave should handle the toast for errors
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await onDelete(config.id);
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <Card>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                    <Label htmlFor={`tax-name-${config.id}`}>Tax Name</Label>
                    <Input
                        id={`tax-name-${config.id}`}
                        type="text"
                        value={config.name || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., VAT"
                        className="max-w-xs"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`tax-rate-${config.id}`}>Tax Rate (%)</Label>
                    <Input
                        id={`tax-rate-${config.id}`}
                        type="number"
                        value={config.rate}
                        onChange={(e) => setConfig(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                        placeholder="e.g., 15"
                        className="max-w-xs"
                    />
                </div>
                 <div className="space-y-4">
                    <Label>Apply Tax On</Label>
                    <div className="space-y-2 rounded-md border p-4">
                        {TAX_COMPONENTS.map(component => (
                            <div key={component.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`tax-on-${config.id}-${component.id}`}
                                    checked={JSON.parse(config.appliedTo).includes(component.id)}
                                    onCheckedChange={(checked) => handleComponentChange(component.id, !!checked)}
                                />
                                <Label htmlFor={`tax-on-${config.id}-${component.id}`} className="font-normal">{component.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button variant="destructive" onClick={() => setIsDeleting(true)} disabled={isSaving || isDeleting}>
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete
                </Button>
                <Button onClick={handleSave} disabled={isSaving || isDeleting}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Configuration
                </Button>
            </CardFooter>
            <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the "{config.name}" tax configuration. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                             {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}


export default function TaxSettingsPage() {
    const [taxes, setTaxes] = useState<TaxConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchTaxConfigs = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/tax');
            if (response.ok) {
                const configs: TaxConfig[] = await response.json();
                setTaxes(configs);
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Could not load tax configurations.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTaxConfigs();
    }, [toast]);
    
    const handleAddNewTax = () => {
        const newTax: TaxConfig = {
            id: `new-${Date.now()}`,
            name: 'New Tax',
            rate: 0,
            appliedTo: '[]'
        };
        setTaxes(prev => [...prev, newTax]);
    }

    const handleSave = async (taxToSave: TaxConfig) => {
        const isNew = taxToSave.id.startsWith('new-');
        const method = isNew ? 'POST' : 'PUT';
        try {
            const response = await fetch('/api/tax', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taxToSave),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save configuration.');
            }
            
            // Refetch all taxes to get the real ID for the new one and ensure sync.
            await fetchTaxConfigs();

        } catch (error: any) {
             toast({ title: 'Error', description: error.message, variant: 'destructive' });
             throw error; // re-throw to be caught by card
        }
    };
    
    const handleDelete = async (taxId: string) => {
        // If it's a new, unsaved tax, just remove from state
        if (taxId.startsWith('new-')) {
            setTaxes(prev => prev.filter(t => t.id !== taxId));
            return;
        }

        try {
            const response = await fetch(`/api/tax?id=${taxId}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete tax configuration.');
            }
            setTaxes(prev => prev.filter(t => t.id !== taxId));
            toast({ title: 'Success', description: 'Tax configuration deleted.' });
        } catch (error: any) {
             toast({ title: 'Error', description: error.message, variant: 'destructive' });
             throw error;
        }
    }


    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Tax Configuration</h2>
                    <p className="text-muted-foreground">Define universal tax rates and apply them to specific loan components.</p>
                </div>
                 <Button onClick={handleAddNewTax}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add New Tax
                </Button>
            </div>
            
             <div className="space-y-4">
                 {isLoading ? (
                    <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
                 ) : taxes.length > 0 ? (
                    taxes.map(tax => (
                        <TaxCard key={tax.id} tax={tax} onSave={handleSave} onDelete={handleDelete} />
                    ))
                 ) : (
                     <Card>
                         <CardContent className="pt-6 text-center text-muted-foreground">
                            No tax configurations found. Click "Add New Tax" to create one.
                         </CardContent>
                     </Card>
                 )}
            </div>
        </div>
    );
}
