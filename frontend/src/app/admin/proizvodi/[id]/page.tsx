import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { Facts } from "@/components/admin/facts";
import { StockBadge } from "@/components/admin/stock-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MovementList, StockList } from "@/lib/backend-types";
import { count, dateTime, money } from "@/lib/format";
import { MOVEMENT_TYPE } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { loadProduct } from "../data";
import { ArchiveButton } from "./archive-button";
import { ProductImages } from "./product-images";

export async function generateMetadata({ params }: PageProps<"/admin/proizvodi/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await loadProduct(id)).name };
}

/** Where a movement came from, as a link when that document has a screen. */
function source(doc: MovementList["items"][number]["document"]) {
  if (!doc) return "—";
  if (doc.type === "ORDER") {
    return (
      <Link href={`/admin/narudzbe/${doc.id}`} className="underline-offset-4 hover:underline">
        Narudžba {doc.number}
      </Link>
    );
  }
  return doc.number;
}

export default async function ProductPage({ params }: PageProps<"/admin/proizvodi/[id]">) {
  const { id } = await params;
  const [product, user, stock, movements] = await Promise.all([
    loadProduct(id),
    requireUser(`/admin/proizvodi/${id}`),
    apiServer<StockList>(`/stock?productId=${id}&limit=100`),
    apiServer<MovementList>(`/stock/movements?productId=${id}&limit=15`),
  ]);
  const attributes = Object.entries((product.attributes ?? {}) as Record<string, unknown>);
  const price = Number(product.discountPrice ?? product.sellingPrice);
  // Margin on the price without VAT: that is what the company keeps.
  const cost = "purchasePrice" in product && product.purchasePrice != null ? Number(product.purchasePrice) : null;
  const net = price / (1 + Number(product.vatPercent) / 100);
  const margin = cost !== null && net > 0 ? Math.round(((net - cost) / net) * 1000) / 10 : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/proizvodi" className="text-sm text-muted-foreground hover:text-foreground">
        ← Svi proizvodi
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <StockBadge alert={product.stockAlert} archived={product.isArchived} available={product.stock.available} />
          </div>
          <p className="text-sm text-muted-foreground">
            {product.sku} · {product.category.name}
            {product.brand && ` · ${product.brand.name}`}
          </p>
        </div>
        {user.role === "ADMIN" && (
          <div className="flex gap-2">
            <Link href={`/admin/proizvodi/${id}/uredi`} className={buttonVariants({ variant: "outline" })}>
              Izmijeni
            </Link>
            <ArchiveButton id={id} archived={product.isArchived} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Na stanju" value={count(product.stock.quantity)} />
        <Stat label="Rezervisano" value={count(product.stock.reserved)} />
        <Stat label="Dostupno" value={count(product.stock.available)} />
        <Stat label="U prenosu" value={count(product.stock.inTransit)} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <ProductImages
            productId={id}
            productName={product.name}
            initial={product.images}
            canEdit={user.role === "ADMIN"}
          />

          {(product.description || attributes.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Opis i karakteristike</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                {product.description && <p className="whitespace-pre-line">{product.description}</p>}
                {attributes.length > 0 && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                    {attributes.map(([k, v]) => [
                      <dt key={`${k}-t`} className="text-muted-foreground">{k}</dt>,
                      <dd key={`${k}-d`}>{typeof v === "string" ? v : JSON.stringify(v)}</dd>,
                    ])}
                  </dl>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Zaliha po skladištima</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                head={["Skladište", "Na stanju", "Rezervisano", "Dostupno"]}
                align={[1, 2, 3]}
                empty="Proizvoda nema ni na jednom skladištu."
                rows={(stock.data?.items ?? []).map((s) => [
                  s.warehouse.name,
                  count(s.quantity),
                  count(s.reserved),
                  count(s.available),
                ])}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Posljednja kretanja</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                head={["Vrijeme", "Vrsta", "Količina", "Stanje", "Skladište", "Dokument", "Zaposleni"]}
                align={[2, 3]}
                minWidth="44rem"
                empty="Još nema kretanja robe."
                rows={(movements.data?.items ?? []).map((m) => [
                  <span key="t" className="whitespace-nowrap">{dateTime(m.createdAt)}</span>,
                  <div key="v" className="flex flex-col">
                    <span>{MOVEMENT_TYPE[m.type]}</span>
                    {m.serialNumber && <span className="text-xs text-muted-foreground">{m.serialNumber}</span>}
                  </div>,
                  <span key="q" className={m.quantity < 0 ? "text-destructive" : undefined}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </span>,
                  m.balanceAfter,
                  m.warehouse.name,
                  source(m.document),
                  m.user.name,
                ])}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Cijene</CardTitle>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  ["Prodajna", money(product.sellingPrice)],
                  product.discountPrice && ["Akcijska", money(product.discountPrice)],
                  product.discountEndsAt && ["Akcija važi do", dateTime(product.discountEndsAt)],
                  ["PDV", `${Number(product.vatPercent)}%`],
                  cost !== null && ["Nabavna", money(cost)],
                  margin !== null && ["Marža (bez PDV-a)", `${margin.toLocaleString("sr-Latn-ME")}%`],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Podaci</CardTitle>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  ["Šifra", product.sku],
                  ["Bar-kod", product.barcode ?? "—"],
                  product.model && ["Model", product.model],
                  ["Garancija", product.warrantyMonths ? `${product.warrantyMonths} mj.` : "—"],
                  product.weightKg && ["Težina", `${Number(product.weightKg).toLocaleString("sr-Latn-ME")} kg`],
                  ["Serijski brojevi", product.trackSerial ? "Da, po komadu" : "Ne"],
                  ["Prag „malo robe“", product.lowStockThreshold ?? "opšti iz podešavanja"],
                  product.ratingCount > 0 && ["Ocjena kupaca", `${Number(product.ratingAvg).toLocaleString("sr-Latn-ME")} (${product.ratingCount})`],
                  ["Izmijenjen", dateTime(product.updatedAt)],
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}
