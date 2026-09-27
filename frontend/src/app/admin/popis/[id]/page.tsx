import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { DocumentLinks } from "@/components/admin/document-links";
import { Facts } from "@/components/admin/facts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryTree, DocumentList } from "@/lib/backend-types";
import { flattenCategories } from "@/lib/categories";
import { count, dateTime } from "@/lib/format";
import { apiServer, requireUser } from "@/lib/session";
import { CountBadge } from "../count-badge";
import { canCount, loadCount } from "../data";
import { CountWorkspace } from "./count-workspace";
import { DiffTable } from "./diff-table";

export async function generateMetadata({ params }: PageProps<"/admin/popis/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Popis ${(await loadCount(id)).number}` };
}

export default async function CountPage({ params }: PageProps<"/admin/popis/[id]">) {
  const { id } = await params;
  const [c, user] = await Promise.all([loadCount(id), requireUser(`/admin/popis/${id}`)]);
  const admin = user.role === "ADMIN";
  const open = c.status === "IN_PROGRESS" || c.status === "COUNTED";
  const counting = c.status === "IN_PROGRESS" && canCount(user.role);
  const s = c.summary;

  const [categories, docs] = await Promise.all([
    c.categoryId ? apiServer<CategoryTree>("/categories") : null,
    c.status === "APPROVED" ? apiServer<DocumentList>(`/admin/documents?inventoryCountId=${id}`) : null,
  ]);
  const scope = c.categoryId
    ? (flattenCategories(categories?.data ?? []).find((x) => x.id === c.categoryId)?.path ?? "Kategorija")
    : "Cijelo skladište";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/popis" className="text-sm text-muted-foreground hover:text-foreground">
        ← Svi popisi
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Popis {c.number}</h1>
          <CountBadge status={c.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {counting && (
            <ConfirmAction
              path={`/inventory-counts/${id}/finish`}
              label="Završi brojanje"
              title="Završiti brojanje?"
              description="Skeniranje se zatvara, a administrator pregleda razlike i odobrava ih."
              done="Brojanje je završeno."
            />
          )}
          {admin && c.status === "COUNTED" && (
            <>
              <ConfirmAction
                path={`/inventory-counts/${id}/reopen`}
                label="Vrati na brojanje"
                title="Vratiti popis na brojanje?"
                description="Magacioneri ponovo mogu skenirati i ispravljati stavke."
                done="Popis je vraćen na brojanje."
              />
              <ConfirmAction
                path={`/inventory-counts/${id}/approve`}
                label="Odobri razlike"
                title="Odobriti razlike?"
                description={`Zaliha se usklađuje sa izbrojanim: manjak ${s.shortageUnits} kom., višak ${s.surplusUnits} kom. Izdaje se popisna lista, a kretanja robe se ponovo otvaraju.`}
                done="Popis je odobren, zaliha je usklađena."
              />
            </>
          )}
          {admin && open && (
            <ConfirmAction
              path={`/inventory-counts/${id}/cancel`}
              label="Otkaži popis"
              title="Otkazati popis?"
              description="Zaliha ostaje kakva je bila, izbrojano se odbacuje, a kretanja robe se ponovo otvaraju."
              done="Popis je otkazan."
              destructive
            />
          )}
        </div>
      </div>

      {open && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Dok je popis otvoren, roba iz njegovog opsega na skladištu „{c.warehouse.name}“ se ne može primati, slati ni
          prodavati.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Proizvoda" value={count(s.products)} />
        <Stat label="Sa razlikom" value={count(s.withDifference)} />
        <Stat label="Manjak (kom.)" value={count(s.shortageUnits)} warn={s.shortageUnits > 0} />
        <Stat label="Višak (kom.)" value={count(s.surplusUnits)} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {counting ? <CountWorkspace count={c} /> : <DiffTable rows={c.lines} />}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Podaci</CardTitle>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  ["Skladište", c.warehouse.name],
                  ["Opseg", scope],
                  ["Početak", `${c.createdBy.name}, ${dateTime(c.createdAt)}`],
                  c.finishedBy && ["Brojanje završeno", `${c.finishedBy.name}, ${dateTime(c.finishedAt)}`],
                  c.approvedBy && ["Odobreno", `${c.approvedBy.name}, ${dateTime(c.approvedAt)}`],
                  c.notes && ["Napomena", c.notes],
                ]}
              />
            </CardContent>
          </Card>
          {docs?.data && (
            <Card>
              <CardHeader>
                <CardTitle>Dokumenti</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentLinks documents={docs.data.items} empty="Popisna lista još nije izdata." />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={warn ? "text-2xl font-semibold text-destructive tabular-nums" : "text-2xl font-semibold tabular-nums"}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
