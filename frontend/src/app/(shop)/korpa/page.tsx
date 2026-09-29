import type { Metadata } from "next";
import { shopInfo } from "@/lib/shop-api";
import { Checkout } from "./checkout";

export const metadata: Metadata = { title: "Korpa" };

export default async function CartPage() {
  const info = await shopInfo();
  return (
    <main className="flex flex-col gap-7 px-4 pt-6 pb-16 lg:px-20 lg:pt-10">
      <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Korpa i poručivanje</h1>
      <Checkout pickupPoints={info?.pickupPoints ?? []} returnDays={info?.returnWindowDays ?? 14} />
    </main>
  );
}
