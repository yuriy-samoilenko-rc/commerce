import { NextResponse, type NextRequest } from "next/server";
import type { LoginResponse } from "@/lib/backend-types";
import { backendUrl, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

/** Logs in against the API and keeps the token in an httpOnly cookie. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const res = await fetch(`${backendUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": request.headers.get("user-agent") ?? "",
    },
    body: JSON.stringify({ email: body?.email, password: body?.password }),
    cache: "no-store",
  }).catch(() => null);

  if (!res) return NextResponse.json({ message: "Server trenutno nije dostupan." }, { status: 502 });
  if (res.status === 401) return NextResponse.json({ message: "Pogrešan email ili lozinka." }, { status: 401 });
  if (res.status === 400) return NextResponse.json({ message: "Unesite ispravan email i lozinku." }, { status: 400 });
  if (!res.ok) return NextResponse.json({ message: "Prijava trenutno nije moguća." }, { status: 502 });

  const { accessToken, user } = (await res.json()) as LoginResponse;
  const response = NextResponse.json({ user });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: accessToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
