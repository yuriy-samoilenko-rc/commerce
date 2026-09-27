import { ArrowLeftRight, ClipboardCheck, PackageOpen, PackagePlus, ScanLine, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { PickingTasks } from "@/lib/backend-types";
import { apiServer, requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { currentWarehouse, total } from "./data";

export const metadata: Metadata = { title: "Početna" };

/** Good morning / day / evening by the business's clock, not the server's. */
function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Podgorica" }).format(new Date()),
  );
  return hour < 11 ? "Dobro jutro" : hour < 18 ? "Dobar dan" : "Dobro veče";
}

export default async function MobileHome() {
  const [user, warehouse] = await Promise.all([requireUser("/m"), currentWarehouse()]);
  const w = warehouse.id;
  const [picking, receivings, transfers, counts] = await Promise.all([
    apiServer<PickingTasks>(`/admin/picking?warehouseId=${w}`).then((r) => r.data?.length ?? 0),
    total(`/receivings?status=DRAFT&warehouseId=${w}&limit=1`),
    total(`/transfers?status=IN_TRANSIT&toWarehouseId=${w}&limit=1`),
    total(`/inventory-counts?status=IN_PROGRESS&warehouseId=${w}&limit=1`),
  ]);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">
          {greeting()}, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {warehouse.name} ·{" "}
          <Link href="/m/skladiste" className="underline underline-offset-4">
            promijeni
          </Link>
        </p>
      </div>

      <Link
        href="/m/skeniraj"
        className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground active:opacity-90"
      >
        <ScanLine className="size-10" />
        Skeniraj
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/m/sklapanje" icon={PackageOpen} label="Sklapanje" count={picking} />
        <Tile href={`/admin/prijem?status=DRAFT&warehouseId=${w}`} icon={PackagePlus} label="Prijem" count={receivings} />
        <Tile href={`/admin/prenos?status=IN_TRANSIT&toWarehouseId=${w}`} icon={ArrowLeftRight} label="Stiže prenosom" count={transfers} />
        <Tile href={`/admin/popis?status=IN_PROGRESS&warehouseId=${w}`} icon={ClipboardCheck} label="Popis" count={counts} />
      </div>
    </>
  );
}

function Tile({ href, icon: Icon, label, count }: { href: string; icon: LucideIcon; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${count}`}
      className="flex h-24 flex-col justify-between rounded-2xl border p-3 active:bg-muted"
    >
      <div className="flex items-center justify-between">
        <Icon className="size-5 text-muted-foreground" />
        <span className={cn("text-2xl font-semibold tabular-nums", count === 0 && "text-muted-foreground")}>{count}</span>
      </div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
