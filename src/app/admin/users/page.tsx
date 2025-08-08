
'use client';

import React, { useState } from 'react';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { useUsers } from '@/hooks/use-users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AddUserDialog } from '@/components/user/add-user-dialog';
import type { User } from '@/lib/types';

export default function AdminUsersPage() {
    const { users, addUser, updateUser } = useUsers();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const handleOpenDialog = (user: User | null = null) => {
        setEditingUser(user);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setEditingUser(null);
        setIsDialogOpen(false);
    };

    const handleSaveUser = (userData: Omit<User, 'id'>) => {
        if (editingUser) {
            updateUser({ ...editingUser, ...userData });
        } else {
            addUser(userData);
        }
    };
    
    const nibBankColor = '#fdb913';

    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
                    <Button onClick={() => handleOpenDialog()} style={{ backgroundColor: nibBankColor }} className="text-white">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add User
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Users</CardTitle>
                        <CardDescription>Manage registered users and their roles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Full Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Phone Number</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.fullName}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.phoneNumber}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'} style={user.role === 'Admin' ? { backgroundColor: nibBankColor, color: 'white' } : {}}>
                                                {user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.status === 'Active' ? 'secondary' : 'destructive'} style={user.status === 'Active' ? { backgroundColor: '#16a34a', color: 'white' } : {}}>
                                                {user.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleOpenDialog(user)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                    </DropdownMenuItem>
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
            <AddUserDialog
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                onSave={handleSaveUser}
                user={editingUser}
                primaryColor={nibBankColor}
            />
        </>
    );
}
