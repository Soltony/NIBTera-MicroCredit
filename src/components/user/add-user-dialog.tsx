
'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { User, UserRole, UserStatus, Role } from '@/lib/types';
import { useLoanProviders } from '@/hooks/use-loan-providers';

interface AddUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Omit<User, 'id'>) => void;
  user: User | null;
  roles: Role[];
  primaryColor?: string;
}

export function AddUserDialog({ isOpen, onClose, onSave, user, roles, primaryColor = '#fdb913' }: AddUserDialogProps) {
  const { providers } = useLoanProviders();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    role: 'Loan Provider' as UserRole,
    status: 'Active' as UserStatus,
    providerId: '',
    providerName: '',
  });

  useEffect(() => {
    const defaultRole = roles.find(r => r.name === 'Loan Provider') ? 'Loan Provider' : (roles[0]?.name || '');

    if (user) {
      setFormData({
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
        providerId: user.providerId || '',
        providerName: user.providerName || '',
      });
    } else {
      setFormData({
        fullName: '',
        email: '',
        phoneNumber: '',
        role: defaultRole as UserRole,
        status: 'Active' as UserStatus,
        providerId: providers.length > 0 ? providers[0].id : '',
        providerName: providers.length > 0 ? providers[0].name : '',
      });
    }
  }, [user, isOpen, providers, roles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field: 'role' | 'status' | 'providerId') => (value: string) => {
    if (field === 'providerId') {
        const selectedProvider = providers.find(p => p.id === value);
        setFormData(prev => ({
            ...prev,
            providerId: value,
            providerName: selectedProvider?.name || ''
        }));
    } else {
        const newRole = field === 'role' ? (value as UserRole) : formData.role;
        setFormData(prev => ({
            ...prev,
            [field]: value,
            // Reset provider if role is not 'Loan Provider'
            providerId: newRole === 'Loan Provider' || newRole === 'Loan Manager' ? prev.providerId : '',
            providerName: newRole === 'Loan Provider' || newRole === 'Loan Manager' ? prev.providerName : '',
        }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Add New User'}</DialogTitle>
          <DialogDescription>
            {user ? 'Update the details of the existing user.' : 'Register a new user for the platform.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fullName" className="text-right">
              Full Name
            </Label>
            <Input id="fullName" value={formData.fullName} onChange={handleChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input id="email" type="email" value={formData.email} onChange={handleChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phoneNumber" className="text-right">
              Phone
            </Label>
            <Input id="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              Role
            </Label>
            <Select onValueChange={handleSelectChange('role')} value={formData.role}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                    <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(formData.role === 'Loan Provider' || formData.role === 'Loan Manager') && (
             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="providerId" className="text-right">
                    Provider
                </Label>
                <Select onValueChange={handleSelectChange('providerId')} value={formData.providerId}>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                        {providers.map(provider => (
                            <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Status
            </Label>
             <Select onValueChange={handleSelectChange('status')} value={formData.status}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" style={{ backgroundColor: primaryColor }} className="text-white">
              {user ? 'Save Changes' : 'Add User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
