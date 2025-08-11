
'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { useRoles } from '@/hooks/use-roles';
import { useLoanProviders } from '@/hooks/use-loan-providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AddUserDialog } from '@/components/user/add-user-dialog';
import { AddRoleDialog } from '@/components/user/add-role-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { User, Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

const PERMISSION_MODULES = ['Users', 'Roles', 'Reports', 'Settings', 'Products'];

function UsersTab() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { roles } = useRoles();
    const { providers } = useLoanProviders();
    const { currentUser } = useAuth();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const { toast } = useToast();
    
    const themeColor = React.useMemo(() => {
        if (currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') {
            return providers.find(p => p.name === 'NIb Bank')?.colorHex || '#fdb913';
        }
        return providers.find(p => p.name === currentUser?.providerName)?.colorHex || '#fdb913';
    }, [currentUser, providers]);

    const fetchUsers = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Could not load user data.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleOpenDialog = (user: User | null = null) => {
        setEditingUser(user);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setEditingUser(null);
        setIsDialogOpen(false);
    };

    const handleSaveUser = async (userData: Omit<User, 'id'> & { id?: string; password?: string }) => {
        const method = editingUser ? 'PUT' : 'POST';
        const endpoint = '/api/users';
        const body = JSON.stringify(editingUser ? { ...userData, id: editingUser.id } : userData);

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save user.');
            }
            
            toast({
                title: `User ${editingUser ? 'Updated' : 'Added'}`,
                description: `${userData.fullName} has been successfully ${editingUser ? 'updated' : 'added'}.`,
            });
            fetchUsers(); // Refresh the user list
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        }
    };
    
    const handleToggleStatus = async (user: User) => {
        const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
        try {
            const response = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, status: newStatus }),
            });
            
             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update status.');
            }
            
            toast({
                title: `User ${newStatus === 'Active' ? 'Activated' : 'Deactivated'}`,
                description: `${user.fullName}'s status has been changed to ${newStatus}.`,
            });
            fetchUsers();
        } catch (error: any) {
             toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <>
            <div className="flex items-center justify-between space-y-2 mb-4">
                <div/>
                <Button onClick={() => handleOpenDialog()} style={{ backgroundColor: themeColor }} className="text-white">
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
                                <TableHead>Role</TableHead>
                                <TableHead>Provider</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.fullName}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === 'Admin' || user.role === 'Super Admin' ? 'default' : 'secondary'} style={user.role === 'Admin' || user.role === 'Super Admin' ? { backgroundColor: themeColor, color: 'white' } : {}}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{user.providerName}</TableCell>
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
                                                <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
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
            <AddUserDialog
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                onSave={handleSaveUser}
                user={editingUser}
                roles={roles}
                primaryColor={themeColor}
            />
        </>
    );
}

function RolesTab() {
    const { roles, addRole, updateRole } = useRoles();
    const { providers } = useLoanProviders();
    const { currentUser } = useAuth();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    const themeColor = React.useMemo(() => {
        if (currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') {
            return providers.find(p => p.name === 'NIb Bank')?.colorHex || '#fdb913';
        }
        return providers.find(p => p.name === currentUser?.providerName)?.colorHex || '#fdb913';
    }, [currentUser, providers]);

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

    return (
        <>
            <div className="flex items-center justify-between space-y-2 mb-4">
                <div />
                <Button onClick={() => handleOpenDialog()} style={{ backgroundColor: themeColor }} className="text-white">
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
            <AddRoleDialog
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                onSave={handleSaveRole}
                role={editingRole}
                primaryColor={themeColor}
            />
        </>
    );
}

export default function AccessControlPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Access Control</h2>
            <Tabs defaultValue="users" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="roles">Roles</TabsTrigger>
                </TabsList>
                <TabsContent value="users">
                    <UsersTab />
                </TabsContent>
                <TabsContent value="roles">
                    <RolesTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
