import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/shop/auth-form";
import { currentCustomer } from "@/lib/shop-api";

export const metadata: Metadata = { title: "Prijava" };

/** Only paths inside the shop, never another site. */
const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/nalog");

export default async function CustomerLoginPage({ searchParams }: PageProps<"/nalog/prijava">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await currentCustomer()) redirect(next);
  return (
    <main className="flex justify-center px-4 py-10 md:py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-shop-line bg-white p-6 md:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Moj nalog</h1>
          <p className="text-[15px] text-shop-muted">Pratite narudžbe, preuzmite račune i sačuvajte listu želja.</p>
        </div>
        <AuthForm initial={sp.registracija === "1" ? "register" : "login"} next={next} />
      </div>
    </main>
  );
}
