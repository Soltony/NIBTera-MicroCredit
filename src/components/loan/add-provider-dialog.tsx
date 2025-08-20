
'use client';

import React, { useState, useEffect } from 'react';
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
import { Building2, Landmark, Briefcase, type LucideIcon, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoanProvider } from '@/lib/types';
import { IconDisplay } from '@/components/icons';
import { Switch } from '../ui/switch';

interface AddProviderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (provider: Omit<LoanProvider, 'products'>) => void;
  provider: LoanProvider | null;
  primaryColor?: string;
}

const icons: { name: string; component: LucideIcon }[] = [
  { name: 'Building2', component: Building2 },
  { name: 'Landmark', component: Landmark },
  { name: 'Briefcase', component: Briefcase },
];

export function AddProviderDialog({ isOpen, onClose, onSave, provider, primaryColor = '#fdb913' }: AddProviderDialogProps) {
  const [providerName, setProviderName] = useState('');
  const [selectedIconName, setSelectedIconName] = useState(icons[0].name);
  const [selectedColorHex, setSelectedColorHex] = useState('#2563eb');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [allowMultipleActiveLoans, setAllowMultipleActiveLoans] = useState(true);


  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (provider) {
        setProviderName(provider.name);
        setSelectedIconName(provider.icon);
        setSelectedColorHex(provider.colorHex || '#2563eb');
        setDisplayOrder(provider.displayOrder || 0);
        setAllowMultipleActiveLoans(!!provider.allowMultipleActiveLoans);
    } else {
        setProviderName('');
        setSelectedIconName(icons[0].name);
        setSelectedColorHex('#2563eb');
        setDisplayOrder(0);
        setAllowMultipleActiveLoans(true);
    }
  }, [provider, isOpen]);

  const handleCustomIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'image/svg+xml' || file.type === 'image/png' || file.type === 'image/jpeg')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setSelectedIconName(result); // Set the icon name to the data URI
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
    if (providerName.trim() === '') return;

    onSave({
      id: provider?.id,
      name: providerName,
      icon: selectedIconName,
      colorHex: selectedColorHex,
      displayOrder: Number(displayOrder),
      allowMultipleActiveLoans: allowMultipleActiveLoans ? 1 : 0,
    } as any);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{provider ? 'Edit Provider' : 'Add New Loan Provider'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="provider-name" className="text-right">
              Name
            </Label>
            <Input
              id="provider-name"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="e.g., Acme Financial"
              required
              className="col-span-3"
              style={{'--ring': primaryColor} as React.CSSProperties}
            />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="display-order" className="text-right">
              Display Order
            </Label>
            <Input
              id="display-order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              required
              className="col-span-3"
              style={{'--ring': primaryColor} as React.CSSProperties}
            />
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
                  className={cn(
                    'h-12 w-12',
                    selectedIconName === name && 'ring-2'
                  )}
                  style={{'--ring': primaryColor} as React.CSSProperties}
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
                        selectedIconName.startsWith('data:image/') && 'ring-2'
                    )}
                    style={{'--ring': primaryColor} as React.CSSProperties}
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
            <Label className="text-right">Color</Label>
            <div className="col-span-3 flex items-center gap-2">
                <Input
                    id="color-picker"
                    type="color"
                    value={selectedColorHex}
                    onChange={(e) => setSelectedColorHex(e.target.value)}
                    className="p-1 h-10 w-14"
                />
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded-md">{selectedColorHex}</span>
            </div>
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="allowMultipleActiveLoans" className="text-right">
              Allow Multiple Loans
            </Label>
            <div className="col-span-3">
              <Switch
                id="allowMultipleActiveLoans"
                checked={allowMultipleActiveLoans}
                onCheckedChange={setAllowMultipleActiveLoans}
                className="data-[state=checked]:bg-[--provider-color]"
                style={{'--provider-color': primaryColor} as React.CSSProperties}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" style={{ backgroundColor: primaryColor }} className="text-white">{provider ? 'Save Changes' : 'Add Provider'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
