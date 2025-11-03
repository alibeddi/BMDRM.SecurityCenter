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
      const res = await fetch("/api/session", {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) {
        console.log("[AUTH] Session check failed, status:", res.status);
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
      console.log("[AUTH] Login attempt for:", email);

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include", // ✅ crucial for cookie auth
      });

      console.log("[AUTH] Login response status:", res.status);
      const data = await res.json().catch(() => ({}));
      console.log("[AUTH] Login response data:", data);

      if (!res.ok) {
        throw new Error((data as any)?.error || "Login failed");
      }

      // Immediately update state after successful login
      console.log("[AUTH] Login successful, refreshing session...");
      await refresh();
      console.log("[AUTH] Session refreshed, isAuthenticated updated");
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
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
