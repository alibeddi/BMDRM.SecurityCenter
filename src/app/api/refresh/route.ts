import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "No token found" }, { status: 401 });
    }

    // Check if backend refresh is enabled
    const enableBackendRefresh = process.env.ENABLE_TOKEN_REFRESH === "true";

    if (!enableBackendRefresh) {
      // If backend refresh is not enabled, just return success
      console.log("[REFRESH] Backend refresh disabled, skipping");
      return NextResponse.json({ success: true, refreshed: false });
    }

    const base = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;
    const refreshPath = process.env.API_REFRESH_PATH || "/refresh";

    if (!base) {
      console.log("[REFRESH] No API_BASE configured, skipping refresh");
      return NextResponse.json({ success: true, refreshed: false });
    }

    // Call upstream refresh endpoint
    const upstream = await fetch(`${base}${refreshPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!upstream.ok) {
      console.log("[REFRESH] Backend refresh failed, status:", upstream.status);
      // Don't clear token on refresh failure - it might still be valid
      return NextResponse.json({ success: true, refreshed: false });
    }

    const data = await upstream.json();
    const newToken = data?.accessToken;

    if (newToken) {
      // Update cookie with new token
      const isHttps =
        process.env.NODE_ENV === "production" ||
        process.env.FORCE_HTTPS === "true";

      cookieStore.set("auth_token", newToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isHttps,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      console.log("[REFRESH] Token refreshed successfully");
      return NextResponse.json({ success: true, refreshed: true });
    }

    return NextResponse.json({ success: true, refreshed: false });
  } catch (err) {
    console.error("[REFRESH] Error:", err);
    // Don't fail hard on refresh errors
    return NextResponse.json({ success: true, refreshed: false });
  }
}
