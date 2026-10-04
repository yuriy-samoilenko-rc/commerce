import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { DataTable } from "@/components/admin/data-table";
import { Facts } from "@/components/admin/facts";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupplierCard } from "@/lib/backend-types";
import { count, date, money } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { FINANCE_ROLES } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { ReceivingBadge } from "../../prijem/receiving-badge";
import { SupplierDialog } from "../supplier-dialog";

const loadSupplier = cache(async (id: string) => {
  if (!isUuid(id)) notFound();
  const { status, data } = await apiServer<SupplierCard>(`/suppliers/${id}`);
  if (status === 404) notFound();
  if (!data) throw new Error(`Supplier failed with status ${status}`);
  return data;
});

export async function generateMetadata({ params }: PageProps<"/admin/dobavljaci/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await loadSupplier(id)).name };
}

/** Today in Montenegro as YYYY-MM-DD, to tell whether the contract still runs. */
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Podgorica", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default async function SupplierPage({ params }: PageProps<"/admin/dobavljaci/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/admin/dobavljaci/${id}`);
  if (!FINANCE_ROLES.includes(user.role)) redirect("/admin");
  const s = await loadSupplier(id);
  const canEdit = user.role === "ADMIN" || user.role === "MANAGER";
  const unused = s.stats.receivings === 0 && s.receivings.length === 0;
  const contractExpired = s.contractUntil !== null && s.contractUntil.slice(0, 10) < today();

  const tiles = [
    ["Ukupno nabavljeno", money(s.stats.amount)],
    ["Isporuka", count(s.stats.receivings)],
    ["Posljednja isporuka", date(s.stats.lastReceivedAt)],
    ["Različitih proizvoda", count(s.stats.products)],
  ];

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/dobavljaci" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Dobavljači
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{s.name}</h1>
          {s.isActive ? <Badge>Aktivan</Badge> : <Badge variant="outline">Neaktivan</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <SupplierDialog supplier={s} />}
          {user.role === "ADMIN" && unused && (
            <ConfirmAction
              path={`/suppliers/${s.id}`}
              method="DELETE"
              then="/admin/dobavljaci"
              label="Obriši"
              title={`Obrisati dobavljača „${s.name}“?`}
              description="Dobavljač još nema nijedan prijem, pa se može trajno obrisati."
              done="Dobavljač je obrisan."
              destructive
            />
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <Card key={label} size="sm">
            <CardContent className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{value}</dd>
            </CardContent>
          </Card>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Podaci</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Facts
              rows={[
                ["PIB", s.taxId ?? "—"],
                ["Žiro račun", s.bankAccount ?? "—"],
                ["Kontakt osoba", s.contactPerson ?? "—"],
                ["Telefon", s.phone ? <a href={`tel:${s.phone.replace(/\s/g, "")}`}>{s.phone}</a> : "—"],
                ["E-pošta", s.email ? <a href={`mailto:${s.email}`}>{s.email}</a> : "—"],
                ["Adresa", s.address ?? "—"],
                ["Ugovor", s.contractNumber ? `br. ${s.contractNumber}` : "—"],
                s.contractUntil && [
                  "Važi do",
                  <span key="u" className={contractExpired ? "font-medium text-destructive" : undefined}>
                    {date(s.contractUntil)}
                    {contractExpired && " — istekao"}
                  </span>,
                ],
              ]}
            />
            {s.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{s.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Istorija nabavke</CardTitle>
            {s.receivings.length > 0 && (
              <Link href={`/admin/prijem?supplierId=${s.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Svi prijemi
              </Link>
            )}
          </CardHeader>
          <CardContent>
            <DataTable
              head={["Broj", "Datum", "Skladište", "Komada", "Vrijednost", "Status"]}
              align={[3, 4]}
              minWidth="34rem"
              empty="Od ovog dobavljača još nije bilo prijema."
              rows={s.receivings.map((r) => [
                <div key="n" className="flex flex-col">
                  <Link href={`/admin/prijem/${r.id}`} className="font-medium whitespace-nowrap underline-offset-4 hover:underline">
                    {r.number}
                  </Link>
                  {r.supplierDocNumber && <span className="text-xs text-muted-foreground">račun {r.supplierDocNumber}</span>}
                </div>,
                <span key="d" className="whitespace-nowrap">{date(r.confirmedAt ?? r.createdAt)}</span>,
                r.warehouse.name,
                count(r.units),
                money(r.amount),
                <ReceivingBadge key="b" status={r.status} />,
              ])}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
