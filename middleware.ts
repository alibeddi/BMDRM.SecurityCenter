import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("auth_token")?.value;

  console.log("[MIDDLEWARE]", {
    pathname,
    hasToken: !!token,
    cookies: req.cookies.getAll().map((c) => c.name),
  });

  // Allow public paths
  const publicPaths = [
    "/login",
    "/_next",
    "/favicon.ico",
    "/api/login",
    "/api/logout",
    "/api/session",
    "/api/debug",
  ];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    // If already authenticated and trying to visit login, bounce to home (or next param)
    if (pathname === "/login" && token) {
      console.log(
        "[MIDDLEWARE] Redirecting authenticated user from login to dashboard"
      );
      const url = req.nextUrl.clone();
      const next = url.searchParams.get("next") || "/alerts";
      url.pathname = next;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Protect all other routes (dashboard routes)
  if (!token) {
    console.log("[MIDDLEWARE] No token, redirecting to login");
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  console.log("[MIDDLEWARE] Token found, allowing access");
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/login).*)"],
};
