import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const token = (await cookies()).get("auth_token")?.value;
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const base = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;
  if (!base)
    return NextResponse.json(
      { error: "API_BASE is not configured" },
      { status: 500 }
    );
  const res = await fetch(`${base}/decisions/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok)
    return NextResponse.json(
      { error: await res.text() },
      { status: res.status }
    );
  return NextResponse.json({ success: true });
}
