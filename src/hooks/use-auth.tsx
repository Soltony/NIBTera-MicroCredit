
'use client';

import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useMemo,
  useCallback,
} from 'react';
import { getCurrentUser } from '@/lib/session';

// Define a user type that matches the structure returned by getCurrentUser
export type AuthenticatedUser = Awaited<ReturnType<typeof getCurrentUser>>;

interface AuthContextType {
  currentUser: AuthenticatedUser | null;
  login: (phoneNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  refetchUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
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
    try {
      setIsLoading(true);
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

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

      // After successful login, refetch user data to update context
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
        // Always clear user from state regardless of API call success
        setCurrentUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      login,
      logout,
      isLoading,
      refetchUser: fetchUser,
    }),
    [currentUser, login, logout, isLoading, fetchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
