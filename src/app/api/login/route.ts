/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  console.log("[LOGIN] API route called");
  try {
    // Accept full login request
    const body = await req.json();
    const { email, password, twoFactorCode, twoFactorRecoveryCode } =
      body || {};
    console.log("[LOGIN] Payload:", {
      email,
      password: !!password,
      twoFactorCode,
      twoFactorRecoveryCode,
    });
    if (!email || !password) {
      console.log("[LOGIN] Missing credentials");
      return NextResponse.json(
        { error: "Missing credentials" },
        { status: 400 }
      );
    }
    const base = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;
    const loginPath = process.env.API_LOGIN_PATH || "/login";
    if (!base) {
      console.log("[LOGIN] No API_BASE configured!");
      return NextResponse.json(
        { error: "API_BASE is not configured" },
        { status: 500 }
      );
    }
    // Forward all possible fields
    const upstream = await fetch(`${base}${loginPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        twoFactorCode,
        twoFactorRecoveryCode,
      }),
    });

    const text = await upstream.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {}
    console.log("[LOGIN] Upstream status", upstream.status, "response", data);

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: (data && (data as any).error) || text || "Invalid credentials",
        },
        { status: 401 }
      );
    }
    const token = (data as any)?.accessToken;
    if (!token) {
      console.log("[LOGIN] No accessToken found in response", data);
      return NextResponse.json(
        { error: "No accessToken returned from API" },
        { status: 502 }
      );
    }

    console.log(
      "[LOGIN] Setting auth cookie with token (length:",
      token.length,
      ")"
    );

    // Cookie settings optimized for both dev and production
    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    };

    console.log("[LOGIN] Cookie options:", cookieOptions);

    // Use cookies() from next/headers for Next.js 15+
    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, cookieOptions);

    console.log("[LOGIN] Auth cookie set successfully via cookies()");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[LOGIN] Error: ", err && (err as Error).message);
    return NextResponse.json(
      { error: (err as Error)?.message || "Login failed" },
      { status: 500 }
    );
  }
}
