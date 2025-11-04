/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";

import { useRouter, usePathname } from "next/navigation";

type AuthContextValue = {
  isAuthenticated: boolean | null; // null while loading
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  checkSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Session check interval (5 minutes)
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;

// Refresh token interval (10 minutes)
const REFRESH_INTERVAL = 10 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingOutRef = useRef(false);
  const justLoggedInRef = useRef(false);

  // Check session validity
  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      console.log("[AUTH] Checking session...");
      const res = await fetch("/api/session", {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok || res.status === 401) {
        console.log("[AUTH] Session invalid or expired, status:", res.status);
        setIsAuthenticated(false);

        // Don't redirect if we just logged in (give it time to settle)
        // If user is on a protected page and session is invalid, redirect to login
        if (
          !isLoggingOutRef.current &&
          !justLoggedInRef.current &&
          pathname &&
          !pathname.startsWith("/login")
        ) {
          console.log("[AUTH] Redirecting to login due to invalid session");
          router.replace("/login?reason=session_expired");
        }
        return false;
      }

      const data = (await res.json()) as { authenticated: boolean };
      const isAuth = !!data?.authenticated;
      console.log("[AUTH] Session valid:", isAuth);
      setIsAuthenticated(isAuth);

      if (
        !isAuth &&
        !isLoggingOutRef.current &&
        !justLoggedInRef.current &&
        pathname &&
        !pathname.startsWith("/login")
      ) {
        console.log(
          "[AUTH] Redirecting to login due to unauthenticated session"
        );
        router.replace("/login?reason=session_expired");
      }

      return isAuth;
    } catch (err) {
      console.error("[AUTH] Session check error:", err);
      setIsAuthenticated(false);
      return false;
    }
  }, [router, pathname]);

  // Refresh authentication token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      console.log("[AUTH] Refreshing token...");
      const res = await fetch("/api/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok || res.status === 401) {
        console.log("[AUTH] Token refresh failed, status:", res.status);
        setIsAuthenticated(false);

        if (
          !isLoggingOutRef.current &&
          pathname &&
          !pathname.startsWith("/login")
        ) {
          console.log("[AUTH] Redirecting to login due to refresh failure");
          router.replace("/login?reason=token_expired");
        }
        return false;
      }

      const data = await res.json();
      console.log("[AUTH] Token refresh successful:", data);
      return true;
    } catch (err) {
      console.error("[AUTH] Token refresh error:", err);
      return false;
    }
  }, [router, pathname]);

  // Legacy refresh method (now calls checkSession)
  const refresh = useCallback(async () => {
    await checkSession();
  }, [checkSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      console.log("[AUTH] Login attempt for:", email);

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      console.log("[AUTH] Login response status:", res.status);
      const data = await res.json().catch(() => ({}));
      console.log("[AUTH] Login response data:", data);

      if (!res.ok) {
        throw new Error((data as any)?.error || "Login failed");
      }

      // Set flag to prevent immediate logout redirect
      justLoggedInRef.current = true;

      // Immediately update state after successful login
      console.log("[AUTH] Login successful, checking session...");
      await checkSession();
      console.log("[AUTH] Session checked, isAuthenticated updated");

      // Clear the flag after a short delay
      setTimeout(() => {
        justLoggedInRef.current = false;
      }, 2000);
    },
    [checkSession]
  );

  const logout = useCallback(async () => {
    isLoggingOutRef.current = true;

    // Clear intervals
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });

    setIsAuthenticated(false);
    router.replace("/login");

    // Reset logout flag after navigation
    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 1000);
  }, [router]);

  // Setup periodic session checks and token refresh
  useEffect(() => {
    if (isAuthenticated === true) {
      console.log(
        "[AUTH] Setting up periodic session checks and token refresh"
      );

      // Check session every 5 minutes
      sessionCheckIntervalRef.current = setInterval(() => {
        console.log("[AUTH] Periodic session check");
        void checkSession();
      }, SESSION_CHECK_INTERVAL);

      // Refresh token every 10 minutes
      refreshIntervalRef.current = setInterval(() => {
        console.log("[AUTH] Periodic token refresh");
        void refreshToken();
      }, REFRESH_INTERVAL);

      return () => {
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
          sessionCheckIntervalRef.current = null;
        }
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }
  }, [isAuthenticated, checkSession, refreshToken]);

  // Initial session check
  useEffect(() => {
    const id = setTimeout(() => {
      void checkSession();
    }, 0);
    return () => clearTimeout(id);
  }, [checkSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, login, logout, refresh, checkSession }),
    [isAuthenticated, login, logout, refresh, checkSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
