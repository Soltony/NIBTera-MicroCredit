
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Role, Permissions } from '@/lib/types';
import { produce } from 'immer';

const initialPermissions = {
    users: { create: true, read: true, update: true, delete: true },
    roles: { create: true, read: true, update: true, delete: true },
    reports: { create: true, read: true, update: true, delete: true },
    settings: { create: true, read: true, update: true, delete: true },
    products: { create: true, read: true, update: true, delete: true },
};

const MOCK_ROLES_DATA: Role[] = [
    {
        id: 'role-1',
        name: 'Super Admin',
        permissions: initialPermissions,
    },
    {
        id: 'role-2',
        name: 'Loan Manager',
        permissions: produce(initialPermissions, draft => {
            draft.users.create = false;
            draft.users.delete = false;
            draft.roles.create = false;
            draft.roles.read = false;
            draft.roles.update = false;
            draft.roles.delete = false;
        }),
    },
    {
        id: 'role-3',
        name: 'Auditor',
        permissions: produce(initialPermissions, draft => {
            draft.users.read = true;
            draft.roles.read = true;
            draft.reports.read = true;
            draft.settings.read = true;
            draft.products.read = true;
            
            draft.users.create = false;
            draft.users.update = false;
            draft.users.delete = false;
            draft.roles.create = false;
            draft.roles.update = false;
            draft.roles.delete = false;
            draft.settings.update = false;
        }),
    }
];

const STORAGE_KEY = 'loanRoles';

export function useRoles() {
    const [roles, setRoles] = useState<Role[]>([]);

    useEffect(() => {
        try {
            const item = window.localStorage.getItem(STORAGE_KEY);
            if (item) {
                setRoles(JSON.parse(item));
            } else {
                setRoles(MOCK_ROLES_DATA);
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_ROLES_DATA));
            }
        } catch (error) {
            console.warn(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
            setRoles(MOCK_ROLES_DATA);
        }
    }, []);

    const saveRoles = useCallback((updatedRoles: Role[]) => {
        setRoles(updatedRoles);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRoles));
        } catch (error) {
            console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
        }
    }, []);

    const addRole = useCallback((newRole: Omit<Role, 'id'>) => {
        const roleWithId: Role = {
            ...newRole,
            id: `role-${Date.now()}`,
        };
        saveRoles([...roles, roleWithId]);
    }, [roles, saveRoles]);

    const updateRole = useCallback((updatedRole: Role) => {
        const updatedRoles = roles.map(r => (r.id === updatedRole.id ? updatedRole : r));
        saveRoles(updatedRoles);
    }, [roles, saveRoles]);

    return { roles, addRole, updateRole };
}
