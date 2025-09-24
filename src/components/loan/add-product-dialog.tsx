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
import { Briefcase, Home, PersonStanding, type LucideIcon, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoanProduct } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface AddProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Omit<LoanProduct, 'id' | 'status' | 'serviceFee' | 'dailyFee' | 'penaltyRules' | 'providerId' > & {providerId: string}) => void;
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
  const [duration, setDuration] = useState('30');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCustomIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'image/svg+xml' || file.type === 'image/png' || file.type === 'image/jpeg')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setSelectedIconName(result);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select an SVG, PNG, or JPG file.');
    }
  };

  const handleSelectIcon = (name: string) => {
    setSelectedIconName(name);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productName.trim() === '') return;

    const parsedDuration = parseInt(duration);
    
    // The parent component will add the providerId
    onAddProduct({
      name: productName,
      description,
      icon: selectedIconName,
      minLoan: parseFloat(minLoan) || 0,
      maxLoan: parseFloat(maxLoan) || 0,
      duration: isNaN(parsedDuration) ? 30 : parsedDuration,
    } as any);
    
    // Reset form
    setProductName('');
    setDescription('');
    setSelectedIconName(icons[0].name);
    setMinLoan('');
    setMaxLoan('');
    setDuration('30');

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
                        onClick={() => handleSelectIcon(name)}
                        className={cn('h-12 w-12', selectedIconName === name && 'ring-2 ring-primary')}
                    >
                        <Icon className="h-6 w-6" />
                    </Button>
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            'h-12 w-12',
                            selectedIconName.startsWith('data:image/') && 'ring-2 ring-primary'
                        )}
                    >
                       {selectedIconName.startsWith('data:image/') ? (
                          <img src={selectedIconName} alt="Custom Icon" className="h-6 w-6" />
                        ) : (
                          <Upload className="h-6 w-6" />
                        )}
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/svg+xml,image/png,image/jpeg"
                        onChange={handleCustomIconUpload}
                    />
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
              <Label htmlFor="duration" className="text-right">Duration (days)</Label>
              <Input id="duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="col-span-3" required />
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
