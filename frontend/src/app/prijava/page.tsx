import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Prijava" };

export default async function LoginPage({ searchParams }: PageProps<"/prijava">) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </main>
  );
}
