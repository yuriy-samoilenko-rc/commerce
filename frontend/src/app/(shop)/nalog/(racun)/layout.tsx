import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/shop-api";
import { AccountNav } from "./account-nav";

/** Everything under /nalog except login needs a customer account. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const customer = await currentCustomer();
  if (!customer) redirect("/nalog/prijava");
  const initials = customer.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <main className="flex flex-col gap-6 px-4 pt-6 pb-16 lg:flex-row lg:items-start lg:gap-8 lg:px-20 lg:pt-10">
      <AccountNav name={customer.name} email={customer.email} initials={initials} />
      <div className="flex min-w-0 grow flex-col gap-6">{children}</div>
    </main>
  );
}
