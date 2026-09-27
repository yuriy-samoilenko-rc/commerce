import type { Metadata } from "next";
import Link from "next/link";
import { currentWarehouse } from "../data";
import { Lookup } from "./lookup";

export const metadata: Metadata = { title: "Skeniranje" };

export default async function ScanPage() {
  const warehouse = await currentWarehouse();
  return (
    <>
      <div>
        <Link href="/m" className="text-sm text-muted-foreground">
          ← Početna
        </Link>
        <h1 className="text-xl font-semibold">Skeniranje</h1>
      </div>
      <Lookup warehouseId={warehouse.id} warehouseName={warehouse.name} />
    </>
  );
}
