import { NextResponse, type NextRequest } from "next/server";
import { backendUrl, SESSION_COOKIE } from "@/lib/session";

// Only these travel between browser and API; cookies and client-sent auth never do.
const FORWARD_REQUEST = ["content-type", "accept", "user-agent"];
const FORWARD_RESPONSE = ["content-type", "content-disposition", "cache-control"];

/**
 * Same-origin gateway to the NestJS API: the browser calls /api/backend/..., and this
 * adds the token from the httpOnly cookie. The token never reaches page scripts.
 */
async function forward(request: NextRequest, ctx: RouteContext<"/api/backend/[...path]">) {
  const { path } = await ctx.params;
  if (path.some((segment) => segment === ".." || segment === ".")) {
    return NextResponse.json({ message: "Neispravna putanja." }, { status: 400 });
  }

  // CSRF: a state-changing request must come from our own pages.
  const origin = request.headers.get("origin");
  if (request.method !== "GET" && origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ message: "Zahtjev nije dozvoljen." }, { status: 403 });
  }

  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);

  const target = `${backendUrl()}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ message: "Server trenutno nije dostupan." }, { status: 502 });

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const response = new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  // An expired or revoked token: drop it so the next page load goes to the login screen.
  if (upstream.status === 401 && token) {
    response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  }
  return response;
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
