import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // For now, just check if token exists
  // Backend validation can be enabled later via environment variable
  const validateWithBackend =
    process.env.VALIDATE_TOKEN_WITH_BACKEND === "true";

  if (!validateWithBackend) {
    // Simple mode: just check if token exists
    return NextResponse.json({ authenticated: true });
  }

  // Validate token with backend (optional)
  const base = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;
  const validatePath = process.env.API_VALIDATE_PATH || "/validate";

  if (!base) {
    // If no API base, just check if token exists
    return NextResponse.json({ authenticated: true });
  }

  try {
    // Try to validate token with backend
    const res = await fetch(`${base}${validatePath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      // Token is invalid, clear it
      cookieStore.delete("auth_token");
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true });
  } catch (err) {
    console.error("[SESSION] Validation error:", err);
    // On error, assume token is still valid (network issues, etc.)
    return NextResponse.json({ authenticated: true });
  }
}
