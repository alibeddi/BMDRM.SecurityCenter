/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug function to check cookie status
  const checkDebug = async () => {
    try {
      const res = await fetch("/api/debug");
      const data = await res.json();
      console.log("[LOGIN PAGE] Debug info:", data);
      alert(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("[LOGIN PAGE] Debug error:", err);
    }
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated === true) {
      const next = params.get("next") || "/alerts";
      console.log("[LOGIN PAGE] Already authenticated, redirecting to:", next);
      router.replace(next);
    }
  }, [isAuthenticated, router, params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log("[LOGIN PAGE] Submitting login form", { email });
    try {
      await login(email, password);
      console.log("[LOGIN PAGE] Login function completed");

      // Wait a bit for the auth state to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      const next = params.get("next") || "/alerts";
      console.log("[LOGIN PAGE] Redirecting to:", next);
      router.replace(next);
    } catch (err: any) {
      console.log("[LOGIN PAGE] Login error:", err);
      setError(err?.message || "Login failed");
      setLoading(false);
    }
    // Don't set loading to false on success, let the redirect happen
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white shadow rounded-lg p-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">BMDRM Security</h1>
          <p className="mt-1 text-sm text-gray-600">Sign in to continue</p>
        </div>
        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60">
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <button
            type="button"
            onClick={checkDebug}
            className="w-full inline-flex items-center justify-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
            Debug Cookie Status
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading…
        </div>
      }>
      <LoginInner />
    </Suspense>
  );
}
