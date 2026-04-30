import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/job-tracker", "/api/graphql"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // Allow the demo route through without auth
  if (pathname.startsWith("/job-tracker/demo")) {
    return NextResponse.next();
  }

  if (isProtected) {
    const token =
      request.cookies.get("next-auth.session-token") ??
      request.cookies.get("__Secure-next-auth.session-token");

    if (!token) {
      const signInUrl = new URL("/api/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", request.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/job-tracker/:path*", "/api/graphql"],
};
