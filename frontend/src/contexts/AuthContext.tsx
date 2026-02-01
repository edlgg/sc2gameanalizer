/**
 * Authentication context for SC2 Replay Analyzer
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = apiClient.getToken();
      if (token) {
        try {
          const userData = await apiClient.getMe();
          setUser(userData);
        } catch {
          // Token invalid, clear it
          apiClient.clearToken();
        }
      } else {
        // Check for stored user (offline mode)
        const storedUser = apiClient.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiClient.login(email, password);
    setUser(response.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const response = await apiClient.register(email, password);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    apiClient.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (apiClient.getToken()) {
      try {
        const userData = await apiClient.getMe();
        setUser(userData);
      } catch {
        // Token invalid
        apiClient.clearToken();
        setUser(null);
      }
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
