
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@/lib/types';

const MOCK_USERS_DATA: User[] = [
    {
        id: 'user-1',
        fullName: 'Admin User',
        email: 'admin@loanflow.com',
        phoneNumber: '123-456-7890',
        role: 'Admin',
        status: 'Active',
    },
    {
        id: 'user-2',
        fullName: 'John Provider',
        email: 'john.p@capitalbank.com',
        phoneNumber: '098-765-4321',
        role: 'Loan Provider',
        status: 'Active',
        providerId: 'provider-1',
        providerName: 'Capital Bank',
    },
    {
        id: 'user-3',
        fullName: 'Jane Officer',
        email: 'jane.o@providus.com',
        phoneNumber: '555-555-5555',
        role: 'Loan Provider',
        status: 'Inactive',
        providerId: 'provider-2',
        providerName: 'Providus Financial',
    }
];

const STORAGE_KEY = 'loanUsers';

export function useUsers() {
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        try {
            const item = window.localStorage.getItem(STORAGE_KEY);
            if (item) {
                setUsers(JSON.parse(item));
            } else {
                setUsers(MOCK_USERS_DATA);
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_USERS_DATA));
            }
        } catch (error) {
            console.warn(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
            setUsers(MOCK_USERS_DATA);
        }
    }, []);

    const saveUsers = useCallback((updatedUsers: User[]) => {
        setUsers(updatedUsers);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUsers));
        } catch (error) {
            console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
        }
    }, []);

    const addUser = useCallback((newUser: Omit<User, 'id'>) => {
        const userWithId: User = {
            ...newUser,
            id: `user-${Date.now()}`,
        };
        saveUsers([...users, userWithId]);
    }, [users, saveUsers]);

    const updateUser = useCallback((updatedUser: User) => {
        const updatedUsers = users.map(u => (u.id === updatedUser.id ? updatedUser : u));
        saveUsers(updatedUsers);
    }, [users, saveUsers]);

    return { users, addUser, updateUser };
}
