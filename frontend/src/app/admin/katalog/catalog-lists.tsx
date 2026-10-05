"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { Card, CardContent } from "@/components/ui/card";
import type { ManagedBrands, ManagedCategories } from "@/lib/backend-types";
import { count } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DeleteDialog } from "./delete-dialog";
import { NameDialog } from "./name-dialog";
import { products, subcategories } from "./words";

// Client components on purpose: every row offers the whole list as targets, and
// building those here keeps the page payload to one copy of the list.

type Node = ManagedCategories[number];

/** The tree in display order with depth, and each node's own id plus everything inside it. */
function flatten(tree: Node[], depth = 0): { node: Node; depth: number; inside: string[] }[] {
  return tree.flatMap((node) => {
    const below = flatten(node.children, depth + 1);
    return [{ node, depth, inside: [node.id, ...below.filter((b) => b.depth === depth + 1).flatMap((b) => b.inside)] }, ...below];
  });
}

export function CategoryTree({ tree }: { tree: ManagedCategories }) {
  const rows = flatten(tree);
  const label = (r: (typeof rows)[number]): [string, string] => [r.node.id, `${"   ".repeat(r.depth)}${r.node.name}`];
  const all = rows.map(label);

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
          parents={all}
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
              const elsewhere = () => rows.filter((o) => !r.inside.includes(o.node.id)).map(label);
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
                      parents={all}
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

export function BrandTable({ brands }: { brands: ManagedBrands }) {
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
          rows={brands.map((b) => [
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
                targets={() => brands.filter((o) => o.id !== b.id).map((o): [string, string] => [o.id, o.name])}
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
