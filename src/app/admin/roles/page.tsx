
'use client';

import React, { useState } from 'react';
import { PlusCircle, MoreHorizontal, Check, X } from 'lucide-react';
import { useRoles } from '@/hooks/use-roles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AddRoleDialog } from '@/components/user/add-role-dialog';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const PERMISSION_MODULES = ['Users', 'Roles', 'Reports', 'Settings', 'Products'];

export default function AdminRolesPage() {
    const { roles, addRole, updateRole } = useRoles();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    const handleOpenDialog = (role: Role | null = null) => {
        setEditingRole(role);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setEditingRole(null);
        setIsDialogOpen(false);
    };

    const handleSaveRole = (roleData: Omit<Role, 'id'>) => {
        if (editingRole) {
            updateRole({ ...editingRole, ...roleData });
        } else {
            addRole(roleData);
        }
    };
    
    const nibBankColor = '#fdb913';

    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Role Management</h2>
                    <Button onClick={() => handleOpenDialog()} style={{ backgroundColor: nibBankColor }} className="text-white">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Role
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Roles</CardTitle>
                        <CardDescription>Define roles to control user access and permissions across the application.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px]">Role Name</TableHead>
                                    {PERMISSION_MODULES.map(module => (
                                        <TableHead key={module} className="text-center">{module}</TableHead>
                                    ))}
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roles.map((role) => (
                                    <TableRow key={role.id}>
                                        <TableCell className="font-medium">{role.name}</TableCell>
                                        {PERMISSION_MODULES.map(module => (
                                            <TableCell key={module} className="text-center">
                                                <div className="flex justify-center items-center space-x-2">
                                                    <span title="Create" className={cn(role.permissions[module.toLowerCase()]?.create ? 'text-green-500' : 'text-muted-foreground/30')}>C</span>
                                                    <span title="Read" className={cn(role.permissions[module.toLowerCase()]?.read ? 'text-green-500' : 'text-muted-foreground/30')}>R</span>
                                                    <span title="Update" className={cn(role.permissions[module.toLowerCase()]?.update ? 'text-green-500' : 'text-muted-foreground/30')}>U</span>
                                                    <span title="Delete" className={cn(role.permissions[module.toLowerCase()]?.delete ? 'text-green-500' : 'text-muted-foreground/30')}>D</span>
                                                </div>
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleOpenDialog(role)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <AddRoleDialog
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                onSave={handleSaveRole}
                role={editingRole}
                primaryColor={nibBankColor}
            />
        </>
    );
}
