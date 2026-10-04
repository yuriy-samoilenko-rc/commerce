import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nova lozinka", robots: { index: false } };

export default async function NewPasswordPage({ searchParams }: PageProps<"/nalog/nova-lozinka">) {
  const { token } = await searchParams;
  return (
    <main className="flex justify-center px-4 py-10 md:py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-shop-line bg-white p-6 md:p-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Nova lozinka</h1>
        {typeof token === "string" && token ? (
          <ResetForm token={token} />
        ) : (
          <p className="text-[15px] text-shop-muted">
            Link nije potpun. Otvorite link iz emaila ili <Link href="/nalog/zaboravljena-lozinka">zatražite novi</Link>.
          </p>
        )}
      </div>
    </main>
  );
}
