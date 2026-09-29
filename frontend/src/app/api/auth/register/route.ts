import { NextResponse, type NextRequest } from "next/server";
import type { LoginResponse } from "@/lib/backend-types";
import { backendUrl, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

/** Creates a customer account and logs it in (the token goes into the httpOnly cookie). */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ message: "Zahtjev nije dozvoljen." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { name?: unknown; email?: unknown; password?: unknown } | null;
  const res = await fetch(`${backendUrl()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": request.headers.get("user-agent") ?? "" },
    body: JSON.stringify({ name: body?.name, email: body?.email, password: body?.password }),
    cache: "no-store",
  }).catch(() => null);

  if (!res) return NextResponse.json({ message: "Server trenutno nije dostupan." }, { status: 502 });
  if (res.status === 409) {
    return NextResponse.json({ message: "Nalog sa ovim emailom već postoji. Prijavite se." }, { status: 409 });
  }
  if (res.status === 400) {
    return NextResponse.json(
      { message: "Provjerite podatke: ispravan email i lozinka od najmanje 8 znakova." },
      { status: 400 },
    );
  }
  if (!res.ok) return NextResponse.json({ message: "Registracija trenutno nije moguća." }, { status: 502 });

  const { accessToken, user } = (await res.json()) as LoginResponse;
  const response = NextResponse.json({ user }, { status: 201 });
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
