
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Briefcase, Home, PersonStanding, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoanProduct } from '@/lib/types';

interface AddProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Omit<LoanProduct, 'id' | 'availableLimit' | 'status'>) => void;
}

const icons: { name: string; component: LucideIcon }[] = [
  { name: 'PersonStanding', component: PersonStanding },
  { name: 'Home', component: Home },
  { name: 'Briefcase', component: Briefcase },
];

export function AddProductDialog({ isOpen, onClose, onAddProduct }: AddProductDialogProps) {
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIconName, setSelectedIconName] = useState(icons[0].name);
  const [minLoan, setMinLoan] = useState('');
  const [maxLoan, setMaxLoan] = useState('');
  const [serviceFee, setServiceFee] = useState('');
  const [dailyFee, setDailyFee] = useState('');
  const [penaltyFee, setPenaltyFee] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productName.trim() === '') return;

    onAddProduct({
      name: productName,
      description,
      icon: selectedIconName,
      minLoan: parseFloat(minLoan),
      maxLoan: parseFloat(maxLoan),
      serviceFee,
      dailyFee,
      penaltyFee,
    });
    
    // Reset form
    setProductName('');
    setDescription('');
    setSelectedIconName(icons[0].name);
    setMinLoan('');
    setMaxLoan('');
    setServiceFee('');
    setDailyFee('');
    setPenaltyFee('');

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Loan Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="product-name" className="text-right">Name</Label>
              <Input id="product-name" value={productName} onChange={(e) => setProductName(e.target.value)} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Icon</Label>
                <div className="col-span-3 flex space-x-2">
                    {icons.map(({ name, component: Icon }) => (
                    <Button
                        key={name}
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setSelectedIconName(name)}
                        className={cn('h-12 w-12', selectedIconName === name && 'ring-2 ring-primary')}
                    >
                        <Icon className="h-6 w-6" />
                    </Button>
                    ))}
                </div>
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="min-loan" className="text-right">Min Loan</Label>
              <Input id="min-loan" type="number" value={minLoan} onChange={(e) => setMinLoan(e.target.value)} className="col-span-3" required />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="max-loan" className="text-right">Max Loan</Label>
              <Input id="max-loan" type="number" value={maxLoan} onChange={(e) => setMaxLoan(e.target.value)} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="service-fee" className="text-right">Service Fee</Label>
              <Input id="service-fee" value={serviceFee} onChange={(e) => setServiceFee(e.target.value)} placeholder="e.g., 3%" className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="daily-fee" className="text-right">Daily Fee</Label>
              <Input id="daily-fee" value={dailyFee} onChange={(e) => setDailyFee(e.target.value)} placeholder="e.g., 0.2%" className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="penalty-fee" className="text-right">Penalty Fee</Label>
              <Input id="penalty-fee" value={penaltyFee} onChange={(e) => setPenaltyFee(e.target.value)} placeholder="e.g., 0.11% daily" className="col-span-3" required />
            </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Add Product</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
