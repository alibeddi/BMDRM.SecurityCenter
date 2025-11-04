/**
 * Custom fetch wrapper that handles 401 responses by redirecting to login
 */

let isRedirecting = false;

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: init?.credentials || "include",
  });

  // If we get a 401, redirect to login (session expired)
  if (response.status === 401 && !isRedirecting) {
    isRedirecting = true;
    console.log("[AUTH_FETCH] 401 response, redirecting to login");

    // Check if we're in the browser
    if (typeof window !== "undefined") {
      // Clear any existing auth state
      try {
        await fetch("/api/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        console.error("[AUTH_FETCH] Logout error:", err);
      }

      // Redirect to login with reason
      const currentPath = window.location.pathname;
      const redirectUrl = `/login?reason=session_expired&next=${encodeURIComponent(
        currentPath
      )}`;
      window.location.href = redirectUrl;
    }
  }

  return response;
}

/**
 * Reset the redirecting flag (useful for testing)
 */
export function resetRedirectFlag() {
  isRedirecting = false;
}
