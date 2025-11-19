
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
import type { User, UserRole, UserStatus, Role, LoanProvider } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

interface AddUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Omit<User, 'id'> & { password?: string }) => void;
  user: User | null;
  roles: Role[];
  providers: LoanProvider[];
  primaryColor?: string;
}

export function AddUserDialog({ isOpen, onClose, onSave, user, roles, providers, primaryColor = '#fdb913' }: AddUserDialogProps) {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    role: '' as UserRole | '',
    status: 'Active' as UserStatus,
    providerId: '' as string | null,
  });

  const availableRoles = React.useMemo(() => {
    if (currentUser?.role === 'Super Admin') {
      return roles;
    }
    // Provider admin can see global roles and roles for their own provider
    return roles.filter(r => !r.providerId || r.providerId === currentUser?.providerId);
  }, [roles, currentUser]);

  useEffect(() => {
    const defaultRole = availableRoles.length > 0 ? availableRoles[0].name : '';
    const defaultProvider = providers.length > 0 ? providers[0] : null;

    if (user) {
      setFormData({
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        password: '', // Password is not edited
        role: user.role,
        status: user.status,
        providerId: user.providerId || null,
      });
    } else {
      setFormData({
        fullName: '',
        email: '',
        phoneNumber: '',
        password: '',
        role: defaultRole as UserRole,
        status: 'Active' as UserStatus,
        providerId: currentUser?.role !== 'Super Admin' ? currentUser?.providerId || null : null,
      });
    }
  }, [user, isOpen, providers, roles, availableRoles, currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field: 'role' | 'status' | 'providerId') => (value: string) => {
    const newRoleName = field === 'role' ? (value as UserRole) : formData.role;
    const selectedRole = roles.find(r => r.name === newRoleName);
    
    setFormData(prev => {
        const updatedState = { ...prev, [field]: value };
        
        // If a role is selected, check if it's provider-specific
        if (field === 'role') {
            if (selectedRole?.providerId) {
                updatedState.providerId = selectedRole.providerId;
            } else if (currentUser?.role !== 'Super Admin') {
                updatedState.providerId = currentUser?.providerId || null;
            } else {
                // If a super admin selects a global role, don't force a provider
                 if (!selectedRole?.providerId) {
                    updatedState.providerId = null;
                 }
            }
        }
        
        return updatedState;
    });
};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submissionData: any = { ...formData };
    if (!user) { 
        if (!submissionData.password) {
            alert('Password is required for new users.');
            return;
        }
    } else {
        delete submissionData.password; 
    }
    
    onSave(submissionData);
    onClose();
  };
  
  const selectedRoleIsProviderScoped = roles.find(r => r.name === formData.role)?.providerId;

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
          {!user && (
             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">
                Password
                </Label>
                <Input id="password" type="password" value={formData.password} onChange={handleChange} className="col-span-3" required />
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              Role
            </Label>
            <Select onValueChange={handleSelectChange('role')} value={formData.role}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map(role => (
                    <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
           <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="providerId" className="text-right">
                    Provider
                </Label>
                <Select
                    onValueChange={handleSelectChange('providerId')}
                    value={formData.providerId || 'none'}
                    disabled={currentUser?.role !== 'Super Admin'}
                >
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">N/A</SelectItem>
                        {providers.map(provider => (
                            <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          
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

    