import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/admin/data-table";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SupplierList } from "@/lib/backend-types";
import { count, date, money } from "@/lib/format";
import { FINANCE_ROLES } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { SupplierDialog } from "./supplier-dialog";

export const metadata: Metadata = { title: "Dobavljači" };

const STATUS = { aktivni: "Aktivni", neaktivni: "Neaktivni" };

export default async function SuppliersPage({ searchParams }: PageProps<"/admin/dobavljaci">) {
  const user = await requireUser("/admin/dobavljaci");
  if (!FINANCE_ROLES.includes(user.role)) redirect("/admin");
  const sp = await searchParams;
  const { status, data } = await apiServer<SupplierList>("/suppliers");
  if (!data) throw new Error(`Suppliers failed with status ${status}`);

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const state = pickParam(sp.status, STATUS);
  const needle = q.toLocaleLowerCase("sr-Latn");
  const rows = data.filter(
    (s) =>
      (!state || s.isActive === (state === "aktivni")) &&
      (!needle ||
        [s.name, s.taxId, s.contactPerson, s.email, s.phone].some((v) => v?.toLocaleLowerCase("sr-Latn").includes(needle))),
  );
  const canEdit = user.role === "ADMIN" || user.role === "MANAGER";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Dobavljači</h1>
        {canEdit && <SupplierDialog />}
      </div>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Naziv, PIB, kontakt…"
          aria-label="Pretraga dobavljača"
          className="w-64"
        />
        <FilterSelect name="status" label="Status" value={state} options={STATUS} all="Svi" />
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
        {(q || state) && (
          <Link href="/admin/dobavljaci" className={buttonVariants({ variant: "ghost" })}>
            Poništi filtere
          </Link>
        )}
      </form>

      <Card>
        <CardContent>
          <DataTable
            head={["Dobavljač", "Kontakt", "Isporuka", "Nabavljeno", "Posljednja isporuka", "Status"]}
            align={[2, 3]}
            minWidth="52rem"
            empty={data.length ? "Nema dobavljača koji odgovaraju filterima." : "Još nema dobavljača."}
            rows={rows.map((s) => [
              <div key="n" className="flex flex-col">
                <Link href={`/admin/dobavljaci/${s.id}`} className="font-medium underline-offset-4 hover:underline">
                  {s.name}
                </Link>
                {s.taxId && <span className="text-xs text-muted-foreground">PIB {s.taxId}</span>}
              </div>,
              <div key="c" className="flex flex-col text-xs">
                {s.contactPerson && <span className="text-sm">{s.contactPerson}</span>}
                {s.phone && <span>{s.phone}</span>}
                {s.email && <span className="text-muted-foreground">{s.email}</span>}
                {!s.contactPerson && !s.phone && !s.email && "—"}
              </div>,
              count(s.stats.receivings),
              money(s.stats.amount),
              date(s.stats.lastReceivedAt),
              s.isActive ? <Badge key="s">Aktivan</Badge> : <Badge key="s" variant="outline">Neaktivan</Badge>,
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
