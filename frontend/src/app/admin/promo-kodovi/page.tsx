import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PromoCodeList } from "@/lib/backend-types";
import { date, money } from "@/lib/format";
import { apiServer, requireUser } from "@/lib/session";
import { PromoDialog } from "./promo-dialog";

export const metadata: Metadata = { title: "Promo kodovi" };

/** Whether the moment has passed (rendered once per request on the server). */
const passed = (iso: string | null) => iso !== null && new Date(iso).getTime() <= Date.now();

export default async function PromoCodesPage() {
  const user = await requireUser("/admin/promo-kodovi");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/admin");
  const { status, data } = await apiServer<PromoCodeList>("/admin/promo-codes");
  if (!data) throw new Error(`Promo codes failed with status ${status}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Promo kodovi</h1>
        <PromoDialog />
      </div>
      <p className="text-sm text-muted-foreground">
        Kupac upisuje kod u korpi. Popust se raspoređuje na cijene stavki, pa račun, PDV i povraćaj odgovaraju plaćenom iznosu.
        Otkazana narudžba vraća iskorišćenje koda.
      </p>
      <Card>
        <CardContent>
          <DataTable
            head={["Kod", "Popust", "Uslovi", "Važi", "Iskorišćeno", "Status", ""]}
            minWidth="56rem"
            empty="Još nema promo kodova."
            rows={data.map((p) => {
              const expired = passed(p.endsAt);
              const upcoming = p.startsAt !== null && !passed(p.startsAt);
              const usedUp = p.maxUses !== null && p.usedCount >= p.maxUses;
              return [
                <div key="c" className="flex flex-col">
                  <span className="font-mono font-medium">{p.code}</span>
                  {p.description && <span className="text-xs text-muted-foreground">{p.description}</span>}
                </div>,
                p.type === "PERCENT" ? `${Number(p.value)}%` : money(p.value),
                <div key="u" className="flex flex-col text-xs">
                  {p.minSubtotal && <span>od {money(p.minSubtotal)}</span>}
                  {p.excludeSaleItems && <span>bez proizvoda na akciji</span>}
                  {p.onePerCustomer && <span>jednom po kupcu</span>}
                </div>,
                <span key="v" className="text-xs whitespace-nowrap">
                  {p.startsAt || p.endsAt ? `${p.startsAt ? date(p.startsAt) : "…"} – ${p.endsAt ? date(p.endsAt) : "…"}` : "bez roka"}
                </span>,
                `${p.usedCount}${p.maxUses !== null ? ` / ${p.maxUses}` : ""}`,
                !p.isActive ? (
                  <Badge key="s" variant="outline">Isključen</Badge>
                ) : expired ? (
                  <Badge key="s" variant="outline">Istekao</Badge>
                ) : usedUp ? (
                  <Badge key="s" variant="outline">Iskorišćen</Badge>
                ) : upcoming ? (
                  <Badge key="s" variant="secondary">Uskoro</Badge>
                ) : (
                  <Badge key="s">Aktivan</Badge>
                ),
                <PromoDialog key="e" promo={p} />,
              ];
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
