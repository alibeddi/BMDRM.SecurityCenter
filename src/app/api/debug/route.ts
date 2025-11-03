import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const token = cookieStore.get("auth_token")?.value;

  return NextResponse.json({
    hasToken: !!token,
    tokenLength: token?.length || 0,
    allCookieNames: allCookies.map((c) => c.name),
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
