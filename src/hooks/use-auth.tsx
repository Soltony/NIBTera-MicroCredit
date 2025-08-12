
'use client';

import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useMemo,
  useCallback,
} from 'react';
import type { getUserFromSession } from '@/lib/user';

// Define a user type that matches the structure returned by getUserFromSession
export type AuthenticatedUser = Awaited<ReturnType<typeof getUserFromSession>>;

interface AuthContextType {
  currentUser: AuthenticatedUser | null;
  setCurrentUser: (user: AuthenticatedUser | null) => void;
  login: (phoneNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  refetchUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  setCurrentUser: () => {},
  login: async () => {},
  logout: async () => {},
  isLoading: true,
  refetchUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({children}: {children: React.ReactNode}) => {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    // This function is now only for explicit refetching, not initial load.
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/user');
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
      } else {
         setCurrentUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSetCurrentUser = useCallback((user: AuthenticatedUser | null) => {
    setCurrentUser(user);
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (phoneNumber: string, password: string) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({phoneNumber, password}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      await fetchUser();
    },
    [fetchUser]
  );

  const logout = useCallback(async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout failed:', error)
    } finally {
        setCurrentUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      setCurrentUser: handleSetCurrentUser,
      login,
      logout,
      isLoading,
      refetchUser: fetchUser,
    }),
    [currentUser, handleSetCurrentUser, login, logout, isLoading, fetchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
