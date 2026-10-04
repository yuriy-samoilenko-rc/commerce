import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/admin/data-table";
import { Card, CardContent } from "@/components/ui/card";
import type { ManagedBrands, ManagedCategories } from "@/lib/backend-types";
import { count } from "@/lib/format";
import { apiServer, requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { DeleteDialog } from "./delete-dialog";
import { NameDialog } from "./name-dialog";

export const metadata: Metadata = { title: "Kategorije i brendovi" };

type Node = ManagedCategories[number];

/** 1 proizvod, 3 proizvoda, 11 proizvoda, 21 proizvod. */
const one = (n: number) => n % 10 === 1 && n % 100 !== 11;
const few = (n: number) => [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100);
const products = (n: number) => `${count(n)} ${one(n) ? "proizvod" : "proizvoda"}`;
const subcategories = (n: number) => `${count(n)} ${one(n) ? "podkategorija" : few(n) ? "podkategorije" : "podkategorija"}`;

/** The tree in display order with depth, and each node's own id plus everything inside it. */
function flatten(tree: Node[], depth = 0): { node: Node; depth: number; inside: string[] }[] {
  return tree.flatMap((node) => {
    const below = flatten(node.children, depth + 1);
    return [{ node, depth, inside: [node.id, ...below.filter((b) => b.depth === depth + 1).flatMap((b) => b.inside)] }, ...below];
  });
}

const TABS = { kategorije: "Kategorije", brendovi: "Brendovi" } as const;

export default async function CatalogPage({ searchParams }: PageProps<"/admin/katalog">) {
  const user = await requireUser("/admin/katalog");
  if (user.role !== "ADMIN") redirect("/admin");
  const sp = await searchParams;
  const tab = sp.tab === "brendovi" ? "brendovi" : "kategorije";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Kategorije i brendovi</h1>
      <nav aria-label="Katalog" className="flex gap-1 border-b">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((t) => (
          <Link
            key={t}
            href={`/admin/katalog?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              t === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {TABS[t]}
          </Link>
        ))}
      </nav>
      {tab === "kategorije" ? <Categories /> : <Brands />}
    </div>
  );
}

async function Categories() {
  const { status, data } = await apiServer<ManagedCategories>("/categories/manage");
  if (!data) throw new Error(`Categories failed with status ${status}`);
  const rows = flatten(data);
  const label = (r: (typeof rows)[number]): [string, string] => [r.node.id, `${"   ".repeat(r.depth)}${r.node.name}`];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Kategorije vide kupci u meniju prodavnice. Adresa stranice (npr. /katalog/televizori) ostaje ista i kad se kategorija
          preimenuje.
        </p>
        <NameDialog
          trigger="Nova kategorija"
          variant="default"
          title="Nova kategorija"
          path="/categories"
          method="POST"
          parents={rows.map(label)}
          done="Kategorija je dodata."
          duplicate="Kategorija sa ovim nazivom već postoji."
        />
      </div>
      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Još nema kategorija.</p>
          ) : (
            <ul className="divide-y" aria-label="Stablo kategorija">
              {rows.map((r) => {
                const { node } = r;
                const inUse = [node.products && products(node.products), node.children.length && subcategories(node.children.length)]
                  .filter(Boolean)
                  .join(" i ");
                // Outside the category and everything below it.
                const elsewhere = rows.filter((o) => !r.inside.includes(o.node.id)).map(label);
                return (
                  <li
                    key={node.id}
                    aria-label={node.name}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                    style={{ paddingLeft: `${r.depth * 1.5}rem` }}
                  >
                    <span className={cn("min-w-0 flex-1", r.depth === 0 && "font-medium")}>
                      {node.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        <Link href={`/admin/proizvodi?categoryId=${node.id}`} className="underline-offset-4 hover:underline">
                          {node.children.length ? `${products(node.totalProducts)} ukupno` : products(node.products)}
                        </Link>
                      </span>
                    </span>
                    <a
                      href={`/katalog/${node.slug}`}
                      target="_blank"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      aria-label={`${node.name} u prodavnici`}
                    >
                      /katalog/{node.slug} <ExternalLink className="size-3" />
                    </a>
                    <div className="flex gap-1">
                      <NameDialog
                        trigger="Podkategorija"
                        variant="ghost"
                        title={`Nova podkategorija u „${node.name}“`}
                        path="/categories"
                        method="POST"
                        parentId={node.id}
                        parents={rows.map(label)}
                        done="Kategorija je dodata."
                        duplicate="Kategorija sa ovim nazivom već postoji."
                      />
                      <NameDialog
                        trigger="Izmijeni"
                        variant="ghost"
                        title={node.name}
                        description="Promjena nadređene kategorije premješta i sve podkategorije."
                        path={`/categories/${node.id}`}
                        method="PATCH"
                        name={node.name}
                        parentId={node.parentId}
                        parents={elsewhere}
                        done="Kategorija je sačuvana."
                        duplicate="Kategorija sa ovim nazivom već postoji."
                      />
                      <DeleteDialog
                        path={`/categories/${node.id}`}
                        title={`Obrisati kategoriju „${node.name}“?`}
                        inUse={inUse}
                        targets={elsewhere}
                        targetLabel="Premjesti proizvode i podkategorije u"
                        done="Kategorija je obrisana."
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

async function Brands() {
  const { status, data } = await apiServer<ManagedBrands>("/brands/manage");
  if (!data) throw new Error(`Brands failed with status ${status}`);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Brisanjem brenda sa proizvodima oni prelaze na drugi brend — tako se spajaju dva naziva istog brenda.
        </p>
        <NameDialog
          trigger="Novi brend"
          variant="default"
          title="Novi brend"
          path="/brands"
          method="POST"
          done="Brend je dodat."
          duplicate="Brend sa ovim nazivom već postoji."
        />
      </div>
      <Card>
        <CardContent>
          <DataTable
            head={["Brend", "Proizvoda", ""]}
            align={[1]}
            empty="Još nema brendova."
            rows={data.map((b) => [
              <span key="n" className="font-medium">
                {b.name}
              </span>,
              <Link key="p" href={`/admin/proizvodi?brandId=${b.id}`} className="underline-offset-4 hover:underline">
                {count(b.products)}
              </Link>,
              <div key="a" className="flex justify-end gap-1">
                <NameDialog
                  trigger="Izmijeni"
                  variant="ghost"
                  title={b.name}
                  path={`/brands/${b.id}`}
                  method="PATCH"
                  name={b.name}
                  done="Brend je sačuvan."
                  duplicate="Brend sa ovim nazivom već postoji."
                />
                <DeleteDialog
                  path={`/brands/${b.id}`}
                  title={`Obrisati brend „${b.name}“?`}
                  inUse={b.products ? products(b.products) : ""}
                  targets={data.filter((o) => o.id !== b.id).map((o): [string, string] => [o.id, o.name])}
                  targetLabel="Prebaci proizvode na brend"
                  done="Brend je obrisan."
                />
              </div>,
            ])}
          />
        </CardContent>
      </Card>
    </>
  );
}
