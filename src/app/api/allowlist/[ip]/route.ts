import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type RouteContext = {
  params: Promise<{ ip: string }>;
};

// DELETE /api/allowlist/[ip] - Remove IP from allowlist
export async function DELETE(req: Request, context: RouteContext) {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;
  if (!base) {
    return NextResponse.json(
      { error: "API_BASE is not configured" },
      { status: 500 }
    );
  }

  const { ip } = await context.params;

  const res = await fetch(`${base}/api/allowlist/${encodeURIComponent(ip)}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return NextResponse.json({ error }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
