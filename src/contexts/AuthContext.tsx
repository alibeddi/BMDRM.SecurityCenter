/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

type AuthContextValue = {
  isAuthenticated: boolean | null; // null while loading
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (!res.ok) {
        setIsAuthenticated(false);
        return;
      }
      const data = (await res.json()) as { authenticated: boolean };
      setIsAuthenticated(!!data?.authenticated);
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.error || "Login failed");
      }
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" });
    setIsAuthenticated(false);
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    const id = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(id);
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, login, logout, refresh }),
    [isAuthenticated, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
