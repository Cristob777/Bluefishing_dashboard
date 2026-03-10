'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  email: string;
  name: string;
  role: 'owner' | 'seller' | 'warehouse' | 'accountant';
  avatar: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ ok: false }),
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

const DEMO_USERS: Record<string, { password: string; user: User }> = {
  'admin@bluefishing.cl': {
    password: 'admin123',
    user: {
      email: 'admin@bluefishing.cl',
      name: 'Cristóbal',
      role: 'owner',
      avatar: 'C',
    },
  },
  'vendedor@bluefishing.cl': {
    password: 'vendedor123',
    user: {
      email: 'vendedor@bluefishing.cl',
      name: 'Andrés Sarasqueta',
      role: 'seller',
      avatar: 'A',
    },
  },
  'bodega@bluefishing.cl': {
    password: 'bodega123',
    user: {
      email: 'bodega@bluefishing.cl',
      name: 'Juan Bodega',
      role: 'warehouse',
      avatar: 'J',
    },
  },
  'demo@demo.com': {
    password: 'demo',
    user: {
      email: 'demo@demo.com',
      name: 'Demo User',
      role: 'owner',
      avatar: 'D',
    },
  },
};

const STORAGE_KEY = 'bluefishing_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 800));

    const entry = DEMO_USERS[email.toLowerCase().trim()];
    if (!entry || entry.password !== password) {
      return { ok: false, error: 'Invalid email or password' };
    }

    setUser(entry.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry.user));
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
