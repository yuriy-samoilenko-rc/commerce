import type { Metadata } from "next";
import Link from "next/link";
import type { CustomerCard } from "@/lib/backend-types";
import { isUuid } from "@/lib/ids";
import { apiServer, requireUser } from "@/lib/session";
import { NewOrderForm, type LinkedCustomer } from "./new-order-form";

export const metadata: Metadata = { title: "Nova narudžba" };

export default async function NewOrderPage({ searchParams }: PageProps<"/admin/narudzbe/nova">) {
  const user = await requireUser("/admin/narudzbe/nova");
  const allowed = user.role === "ADMIN" || user.role === "MANAGER";
  // From a customer card: the order starts linked to that account.
  const { kupac } = await searchParams;
  let initialCustomer: LinkedCustomer | undefined;
  if (allowed && typeof kupac === "string" && isUuid(kupac)) {
    const { data } = await apiServer<CustomerCard>(`/admin/customers/${kupac}`);
    if (data) initialCustomer = { id: data.id, name: data.name, email: data.email, phone: data.phone, address: data.deliveryAddress };
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/narudzbe" className="text-sm text-muted-foreground hover:text-foreground">
        ← Sve narudžbe
      </Link>
      <h1 className="text-2xl font-semibold">Nova narudžba</h1>
      {allowed ? (
        <NewOrderForm initialCustomer={initialCustomer} />
      ) : (
        <p className="text-muted-foreground">Narudžbe unose administrator i menadžer.</p>
      )}
    </div>
  );
}
