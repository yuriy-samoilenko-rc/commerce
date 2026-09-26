import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Stranica nije pronađena</h1>
      <p className="text-muted-foreground">Tražena stranica ili podatak ne postoji.</p>
      <Link href="/" className="underline underline-offset-4">
        Na početnu stranicu
      </Link>
    </main>
  );
}
