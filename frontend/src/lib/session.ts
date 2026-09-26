import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "./backend-types";

/** httpOnly cookie holding the API token; page scripts can never read it. */
export const SESSION_COOKIE = "ts_session";
/** Same lifetime as the backend's JWT (JWT_EXPIRES_IN=1d). */
export const SESSION_MAX_AGE = 60 * 60 * 24;

export const backendUrl = () => process.env.BACKEND_URL ?? "http://localhost:3000";

/** Server-side call to the API as the logged-in user (Server Components, Route Handlers). */
export async function apiServer<T>(path: string): Promise<{ status: number; data: T | null }> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(`${backendUrl()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  return { status: res.status, data: res.ok ? ((await res.json()) as T) : null };
}

/** /auth/me once per request, however many layouts and pages ask for it. */
const me = cache(() => apiServer<User>("/auth/me"));

/** The current user, or a redirect to the login page. */
export async function requireUser(next: string): Promise<User> {
  const { status, data } = await me();
  if (status === 401 || !data) redirect(`/prijava?next=${encodeURIComponent(next)}`);
  return data;
}
