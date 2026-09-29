import type { Metadata } from "next";
import Link from "next/link";
import type { CustomerOrderList } from "@/lib/backend-types";
import { apiServer } from "@/lib/session";
import { cn } from "@/lib/utils";
import { OrderList, productPhotos } from "../order-list";

export const metadata: Metadata = { title: "Moje narudžbe" };

const LIMIT = 10;

export default async function OrdersPage({ searchParams }: PageProps<"/nalog/narudzbe">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.strana) || 1);
  const { data } = await apiServer<CustomerOrderList>(`/orders?page=${page}&limit=${LIMIT}`);
  const orders = data?.items ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / LIMIT));
  const photos = await productPhotos(orders);
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Moje narudžbe</h1>
      <section className="overflow-hidden rounded-3xl border border-shop-line bg-white">
        {orders.length ? (
          <OrderList orders={orders} photos={photos} />
        ) : (
          <p className="p-7 text-shop-muted">
            Još nemate narudžbi. <Link href="/katalog">Pogledajte ponudu</Link>
          </p>
        )}
      </section>
      {pages > 1 && (
        <nav aria-label="Stranice" className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={n > 1 ? `/nalog/narudzbe?strana=${n}` : "/nalog/narudzbe"}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                "flex size-11 items-center justify-center rounded-xl border font-semibold",
                n === page ? "border-shop-blue bg-shop-blue text-white" : "border-shop-line bg-white text-shop-ink",
              )}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
