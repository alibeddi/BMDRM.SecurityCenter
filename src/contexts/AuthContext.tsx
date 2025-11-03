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
      console.log("[AUTH] Refreshing session...");
      const res = await fetch("/api/session", {
        cache: "no-store",
        credentials: "include", // Ensure cookies are sent
      });
      console.log("[AUTH] Session response status:", res.status);
      if (!res.ok) {
        console.log("[AUTH] Session check failed");
        setIsAuthenticated(false);
        return;
      }
      const data = (await res.json()) as { authenticated: boolean };
      console.log("[AUTH] Session data:", data);
      setIsAuthenticated(!!data?.authenticated);
    } catch (err) {
      console.error("[AUTH] Session check error:", err);
      setIsAuthenticated(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      console.log("[AUTH] Login attempt", { email });
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include", // Ensure cookies are sent/received
      });
      console.log("[AUTH] Login response status:", res.status);
      const data = await res.json().catch(() => ({}));
      console.log("[AUTH] Login response data:", data);
      if (!res.ok) {
        throw new Error((data as any)?.error || "Login failed");
      }
      // Refresh authentication state after successful login
      console.log("[AUTH] Login successful, refreshing state...");
      await refresh();
      console.log("[AUTH] State refreshed, isAuthenticated should be updated");
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
