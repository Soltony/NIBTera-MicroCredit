
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
import { saveCustomIcon, getCustomIcon } from '@/lib/types';

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

const colors = [
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Yellow', hex: '#fdb913' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Purple', hex: '#7c3aed' },
];

export function AddProviderDialog({ isOpen, onClose, onSave, provider, primaryColor = '#fdb913' }: AddProviderDialogProps) {
  const [providerName, setProviderName] = useState('');
  const [selectedIconName, setSelectedIconName] = useState(icons[0].name);
  const [selectedColorHex, setSelectedColorHex] = useState(colors[0].hex);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [customIconPreview, setCustomIconPreview] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (provider) {
        setProviderName(provider.name);
        setSelectedIconName(provider.icon);
        setSelectedColorHex(provider.colorHex || colors[0].hex);
        setDisplayOrder(provider.displayOrder || 0);
        if (provider.icon.startsWith('custom-icon-')) {
            setCustomIconPreview(getCustomIcon(provider.icon));
        } else {
            setCustomIconPreview(null);
        }
    } else {
        setProviderName('');
        setSelectedIconName(icons[0].name);
        setSelectedColorHex(colors[0].hex);
        setDisplayOrder(0);
        setCustomIconPreview(null);
    }
  }, [provider, isOpen]);

  const handleCustomIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'image/svg+xml' || file.type === 'image/png')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const iconKey = `custom-icon-${file.name}-${Date.now()}`;
        saveCustomIcon(iconKey, result);
        setSelectedIconName(iconKey);
        setCustomIconPreview(result);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select an SVG or PNG file.');
    }
  };

  const handleSelectIcon = (name: string) => {
    setSelectedIconName(name);
    setCustomIconPreview(null);
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
    });
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
                        customIconPreview && selectedIconName.startsWith('custom-icon-') && 'ring-2'
                    )}
                    style={{'--ring': primaryColor} as React.CSSProperties}
                >
                    {customIconPreview ? (
                        <img src={customIconPreview} alt="Custom Icon" className="h-6 w-6" />
                    ) : (
                        <Upload className="h-6 w-6" />
                    )}
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/svg+xml,image/png"
                    onChange={handleCustomIconUpload}
                />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Color</Label>
            <div className="col-span-3 flex space-x-2">
              {colors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setSelectedColorHex(color.hex)}
                  className={cn(
                    'h-8 w-8 rounded-full border',
                    selectedColorHex === color.hex && 'ring-2 ring-offset-2'
                  )}
                  style={{ backgroundColor: color.hex, '--ring': primaryColor } as React.CSSProperties}
                  aria-label={`Select ${color.name} color`}
                />
              ))}
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
