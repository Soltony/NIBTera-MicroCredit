
'use client';

import React, { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
import type { User } from '@/lib/types';
import { useUsers } from './use-users';

interface AuthContextType {
    currentUser: User | null;
    login: (userId: string) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    login: () => {},
    logout: () => {},
    isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

const CURRENT_USER_STORAGE_KEY = 'currentUser';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const { users, ...userHookRest } = useUsers();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const storedUserId = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
            if (storedUserId && users.length > 0) {
                const user = users.find(u => u.id === storedUserId);
                setCurrentUser(user || null);
            } else if (users.length > 0) {
                // Default to admin user if no one is logged in
                const adminUser = users.find(u => u.role === 'Admin');
                if (adminUser) {
                    setCurrentUser(adminUser);
                    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, adminUser.id);
                }
            }
        } catch (error) {
            console.warn(`Error handling auth state:`, error);
        } finally {
            if (users.length > 0) {
                setIsLoading(false);
            }
        }
    }, [users]);
    
    const login = useCallback((userId: string) => {
        const user = users.find(u => u.id === userId);
        if (user) {
            setCurrentUser(user);
            window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId);
        }
    }, [users]);

    const logout = useCallback(() => {
        setCurrentUser(null);
        window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }, []);

    const value = useMemo(() => ({
        currentUser,
        login,
        logout,
        isLoading,
    }), [currentUser, login, logout, isLoading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
