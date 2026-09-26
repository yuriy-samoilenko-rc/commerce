"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@/lib/backend-types";
import { STAFF_ROLES } from "@/lib/labels";

const schema = z.object({
  email: z.email("Unesite ispravan email."),
  password: z.string().min(1, "Unesite lozinku."),
});
type Values = z.infer<typeof schema>;

/** Only our own pages: "/admin/...", never "//evil.example" or "https://...". */
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = (await res.json().catch(() => ({}))) as { user?: User; message?: string };
    if (!res.ok || !body.user) {
      setError(body.message ?? "Prijava trenutno nije moguća.");
      return;
    }
    const home = STAFF_ROLES.includes(body.user.role) ? "/admin" : "/";
    router.replace(safeNext(next) ?? home);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">TechStore</CardTitle>
        <CardDescription>Prijavite se na svoj nalog.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" autoFocus {...register("email")} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Lozinka</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register("password")} aria-invalid={!!errors.password} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Prijava…" : "Prijavi se"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
