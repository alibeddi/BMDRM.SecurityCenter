import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const token = cookieStore.get("auth_token")?.value;

  console.log(
    "[SESSION] All cookies:",
    allCookies.map((c) => c.name)
  );
  console.log("[SESSION] Auth token exists:", !!token);
  console.log("[SESSION] Token length:", token?.length || 0);

  return NextResponse.json({ authenticated: !!token });
}
