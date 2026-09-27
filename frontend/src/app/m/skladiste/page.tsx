import type { Metadata } from "next";
import type { WarehouseList } from "@/lib/backend-types";
import { apiServer } from "@/lib/session";
import { WarehouseChooser } from "./warehouse-chooser";

export const metadata: Metadata = { title: "Izbor skladišta" };

export default async function ChooseWarehousePage() {
  const { data } = await apiServer<WarehouseList>("/warehouses");
  const active = (data ?? []).filter((w) => w.isActive).map((w) => ({ id: w.id, name: w.name }));
  return (
    <>
      <h1 className="text-xl font-semibold">U kojem ste skladištu?</h1>
      <p className="text-sm text-muted-foreground">Telefon pamti izbor; promijeniti ga možete sa početnog ekrana.</p>
      <WarehouseChooser warehouses={active} />
    </>
  );
}
