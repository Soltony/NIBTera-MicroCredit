
'use client';

import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useMemo,
  useCallback,
} from 'react';
import { getUserFromSession } from '@/lib/session';

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
    try {
      setIsLoading(true);
      const user = await getUserFromSession();
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only run fetchUser if there isn't already a user
    // The user will be passed down from the server-rendered layout
    if (!currentUser) {
        fetchUser();
    } else {
        setIsLoading(false);
    }
  }, [currentUser, fetchUser]);

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
      setCurrentUser,
      login,
      logout,
      isLoading,
      refetchUser: fetchUser,
    }),
    [currentUser, login, logout, isLoading, fetchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
