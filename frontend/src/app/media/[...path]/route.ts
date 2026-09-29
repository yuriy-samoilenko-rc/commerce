import { NextResponse, type NextRequest } from "next/server";
import { backendUrl } from "@/lib/session";

const FORWARD_RESPONSE = ["content-type", "content-length", "cache-control", "etag", "last-modified"];

/**
 * Product photos are public files of the API. Serving them from our own origin keeps one
 * address for the shop and the admin; the backend address is read at run time, like /api/backend.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/media/[...path]">) {
  const { path } = await ctx.params;
  if (path.some((segment) => segment === ".." || segment === "." || segment.startsWith("."))) {
    return new NextResponse(null, { status: 404 });
  }
  const headers = new Headers();
  for (const name of ["if-none-match", "if-modified-since"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const upstream = await fetch(`${backendUrl()}/media/${path.map(encodeURIComponent).join("/")}`, {
    headers,
    cache: "no-store",
  }).catch(() => null);
  if (!upstream) return new NextResponse(null, { status: 502 });

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new NextResponse(upstream.status === 200 ? upstream.body : null, {
    status: upstream.ok || upstream.status === 304 ? upstream.status : 404,
    headers: responseHeaders,
  });
}
