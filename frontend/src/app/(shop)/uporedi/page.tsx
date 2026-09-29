import type { Metadata } from "next";
import { CompareTable } from "./compare-table";

export const metadata: Metadata = { title: "Uporedi proizvode" };

export default function ComparePage() {
  return (
    <main className="flex flex-col gap-6 px-4 pt-6 pb-16 lg:px-20 lg:pt-10">
      <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Uporedi proizvode</h1>
      <CompareTable />
    </main>
  );
}
