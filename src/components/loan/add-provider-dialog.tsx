
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
import { Building2, Landmark, Briefcase, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoanProvider } from '@/lib/types';

interface AddProviderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProvider: (provider: Omit<LoanProvider, 'id' | 'products'>) => void;
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

export function AddProviderDialog({ isOpen, onClose, onAddProvider, primaryColor = '#fdb913' }: AddProviderDialogProps) {
  const [providerName, setProviderName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(icons[0].component);
  const [selectedColorHex, setSelectedColorHex] = useState(colors[0].hex);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (providerName.trim() === '') return;

    onAddProvider({
      name: providerName,
      icon: selectedIcon,
      colorHex: selectedColorHex,
    });
    setProviderName('');
    setSelectedIcon(icons[0].component);
    setSelectedColorHex(colors[0].hex);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Loan Provider</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="provider-name">Provider Name</Label>
              <Input
                id="provider-name"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="e.g., Acme Financial"
                required
                style={{'--ring': primaryColor} as React.CSSProperties}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex space-x-2">
                {icons.map(({ name, component: Icon }) => (
                  <Button
                    key={name}
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSelectedIcon(() => Icon)}
                    className={cn(
                      'h-12 w-12',
                      selectedIcon === Icon && 'ring-2'
                    )}
                    style={{'--ring': primaryColor} as React.CSSProperties}
                  >
                    <Icon className="h-6 w-6" />
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex space-x-2">
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
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" style={{ backgroundColor: primaryColor }} className="text-white">Add Provider</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
