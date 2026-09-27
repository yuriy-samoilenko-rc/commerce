import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no cookie → straight to the login page. The real check
// (valid token, right role) happens in the layouts and, above all, in the API.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("ts_session")) {
    const login = new URL("/prijava", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
}

export const config = {
  // /m and /m/... (the warehouse phone app), not the manifest or icons next to it.
  matcher: ["/admin/:path*", "/m", "/m/:path*"],
};
