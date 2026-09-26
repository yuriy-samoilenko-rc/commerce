import Link from "next/link";

// The online shop comes next; until then the home page only leads staff to the login.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-3xl font-semibold">TechStore</h1>
      <p className="text-muted-foreground">Internet prodavnica je u pripremi.</p>
      <Link href="/prijava" className="text-sm text-primary underline-offset-4 hover:underline">
        Prijava
      </Link>
    </main>
  );
}
