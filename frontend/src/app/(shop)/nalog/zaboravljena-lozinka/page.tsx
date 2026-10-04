import type { Metadata } from "next";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Zaboravljena lozinka", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <main className="flex justify-center px-4 py-10 md:py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-shop-line bg-white p-6 md:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Zaboravljena lozinka</h1>
          <p className="text-[15px] text-shop-muted">Unesite email naloga i poslaćemo vam link za novu lozinku.</p>
        </div>
        <ForgotForm />
      </div>
    </main>
  );
}
