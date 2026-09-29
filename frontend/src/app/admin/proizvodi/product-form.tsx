"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { ProductDetail } from "@/lib/backend-types";
import type { FlatCategory } from "@/lib/categories";
import { indented } from "@/lib/categories";
import { decimalInput, parseDecimal } from "@/lib/format";

const MAX_PRICE = 99_999_999.99; // Decimal(10, 2) in the database

/** A number typed the local way ("1.234,50"); `required` decides whether empty is allowed. */
const decimal = (required: boolean, max: number, digits: number) =>
  z.string().refine(
    (text) => {
      const n = parseDecimal(text);
      if (n === null) return !required;
      const scaled = n * 10 ** digits; // 49.9 * 100 is 4990.000000000001 in floating point
      return !Number.isNaN(n) && n <= max && Math.abs(Math.round(scaled) - scaled) < 1e-6;
    },
    { message: required ? "Unesite iznos, npr. 49,90." : "Unesite broj, npr. 1,5." },
  );
const whole = (max: number) =>
  z.string().trim().refine((t) => t === "" || (/^\d+$/.test(t) && Number(t) <= max), { message: `Cio broj od 0 do ${max}.` });

const schema = z
  .object({
    name: z.string().trim().min(1, "Unesite naziv.").max(200),
    sku: z.string().trim().min(1, "Unesite šifru.").max(64),
    barcode: z.string().trim().max(64),
    model: z.string().trim().max(100),
    categoryId: z.string().min(1, "Izaberite kategoriju."),
    brandId: z.string(),
    description: z.string().max(10_000),
    purchasePrice: decimal(true, MAX_PRICE, 2),
    sellingPrice: decimal(true, MAX_PRICE, 2),
    discountPrice: decimal(false, MAX_PRICE, 2),
    /** datetime-local text, the admin's local time; empty = sale without an end. */
    discountEndsAt: z.string(),
    vatPercent: decimal(true, 100, 2),
    warrantyMonths: whole(600),
    weightKg: decimal(false, 9_999_999, 3),
    lowStockThreshold: whole(100_000),
    trackSerial: z.boolean(),
    attributes: z.array(z.object({ key: z.string().trim().max(100), value: z.string().trim().max(500) })),
  })
  .refine(
    (v) => {
      const discount = parseDecimal(v.discountPrice);
      return discount === null || Number.isNaN(discount) || discount < (parseDecimal(v.sellingPrice) ?? 0);
    },
    { path: ["discountPrice"], message: "Akcijska cijena mora biti niža od prodajne." },
  )
  .refine((v) => !v.discountEndsAt || v.discountPrice.trim() !== "", {
    path: ["discountEndsAt"],
    message: "Kraj akcije se unosi samo uz akcijsku cijenu.",
  })
  .refine((v) => !v.discountEndsAt || new Date(v.discountEndsAt).getTime() > Date.now(), {
    path: ["discountEndsAt"],
    message: "Kraj akcije mora biti u budućnosti.",
  });

/** ISO instant → "YYYY-MM-DDTHH:mm" in local time, for a datetime-local field. */
function localInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
type Values = z.infer<typeof schema>;

function initialValues(p?: ProductDetail): Values {
  return {
    name: p?.name ?? "",
    sku: p?.sku ?? "",
    barcode: p?.barcode ?? "",
    model: p?.model ?? "",
    categoryId: p?.category.id ?? "",
    brandId: p?.brand?.id ?? "",
    description: p?.description ?? "",
    purchasePrice: decimalInput(p?.purchasePrice),
    sellingPrice: decimalInput(p?.sellingPrice),
    discountPrice: decimalInput(p?.discountPrice),
    discountEndsAt: localInput(p?.discountEndsAt),
    vatPercent: p ? decimalInput(p.vatPercent).replace(/,00$/, "") : "21",
    warrantyMonths: p?.warrantyMonths?.toString() ?? "",
    weightKg: p?.weightKg ? decimalInput(p.weightKg, 3).replace(/,?0+$/, "") : "",
    lowStockThreshold: p?.lowStockThreshold?.toString() ?? "",
    trackSerial: p?.trackSerial ?? false,
    attributes: Object.entries((p?.attributes ?? {}) as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    })),
  };
}

/** Empty optional fields are sent as null, so clearing a field on edit really clears it. */
function toPayload(v: Values) {
  const orNull = (s: string) => s.trim() || null;
  const int = (s: string) => (s.trim() ? Number(s) : null);
  return {
    name: v.name,
    sku: v.sku,
    barcode: orNull(v.barcode),
    model: orNull(v.model),
    categoryId: v.categoryId,
    brandId: v.brandId || null,
    description: orNull(v.description),
    purchasePrice: parseDecimal(v.purchasePrice),
    sellingPrice: parseDecimal(v.sellingPrice),
    discountPrice: parseDecimal(v.discountPrice),
    discountEndsAt: v.discountEndsAt && v.discountPrice.trim() ? new Date(v.discountEndsAt).toISOString() : null,
    vatPercent: parseDecimal(v.vatPercent),
    warrantyMonths: int(v.warrantyMonths),
    weightKg: parseDecimal(v.weightKg),
    lowStockThreshold: int(v.lowStockThreshold),
    trackSerial: v.trackSerial,
    attributes: Object.fromEntries(v.attributes.filter((a) => a.key).map((a) => [a.key, a.value])),
  };
}

export function ProductForm({
  product,
  categories,
  brands,
}: {
  /** Omitted when creating a new product. */
  product?: ProductDetail;
  categories: FlatCategory[];
  brands: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initialValues(product) });
  const attributes = useFieldArray({ control, name: "attributes" });
  // Switching serial tracking with goods on hand would break the stock/serial balance.
  const serialLocked = !!product && product.stock.quantity + product.stock.reserved + product.stock.inTransit > 0;

  async function onSubmit(values: Values) {
    setError(null);
    try {
      const saved = await api<ProductDetail>(product ? `/admin/products/${product.id}` : "/admin/products", {
        method: product ? "PATCH" : "POST",
        json: toPayload(values),
      });
      toast.success(product ? "Izmjene su sačuvane." : "Proizvod je kreiran.");
      router.push(`/admin/proizvodi/${saved.id}`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "DUPLICATE" && (e.params.field === "sku" || e.params.field === "barcode")) {
        const field = e.params.field as FieldPath<Values>;
        setFieldError(field, { message: field === "sku" ? "Proizvod sa ovom šifrom već postoji." : "Ovaj bar-kod već ima drugi proizvod." });
        return;
      }
      setError(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    }
  }

  const err = (name: keyof Values) => errors[name]?.message as string | undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid items-start gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Osnovni podaci</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field id="name" label="Naziv" error={err("name")} wide>
            <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
          </Field>
          <Field id="sku" label="Šifra (SKU)" error={err("sku")}>
            <Input id="sku" {...register("sku")} aria-invalid={!!errors.sku} />
          </Field>
          <Field id="barcode" label="Bar-kod" error={err("barcode")}>
            <Input id="barcode" inputMode="numeric" {...register("barcode")} aria-invalid={!!errors.barcode} />
          </Field>
          <Field id="categoryId" label="Kategorija" error={err("categoryId")}>
            <NativeSelect id="categoryId" className="w-full" {...register("categoryId")} aria-invalid={!!errors.categoryId}>
              <NativeSelectOption value="">Izaberite…</NativeSelectOption>
              {categories.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {indented(c)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="brandId" label="Brend">
            <NativeSelect id="brandId" className="w-full" {...register("brandId")}>
              <NativeSelectOption value="">Bez brenda</NativeSelectOption>
              {brands.map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {b.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="model" label="Model" error={err("model")} wide>
            <Input id="model" {...register("model")} />
          </Field>
          <Field id="description" label="Opis" error={err("description")} wide>
            <Textarea id="description" rows={5} {...register("description")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Cijene</CardTitle>
            <CardDescription>Prodajne cijene su sa PDV-om, u eurima.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field id="purchasePrice" label="Nabavna cijena" error={err("purchasePrice")}>
              <Input id="purchasePrice" inputMode="decimal" {...register("purchasePrice")} aria-invalid={!!errors.purchasePrice} />
            </Field>
            <Field id="vatPercent" label="PDV (%)" error={err("vatPercent")}>
              <Input id="vatPercent" inputMode="decimal" {...register("vatPercent")} aria-invalid={!!errors.vatPercent} />
            </Field>
            <Field id="sellingPrice" label="Prodajna cijena" error={err("sellingPrice")}>
              <Input id="sellingPrice" inputMode="decimal" {...register("sellingPrice")} aria-invalid={!!errors.sellingPrice} />
            </Field>
            <Field id="discountPrice" label="Akcijska cijena" error={err("discountPrice")}>
              <Input id="discountPrice" inputMode="decimal" {...register("discountPrice")} aria-invalid={!!errors.discountPrice} />
            </Field>
            <Field id="discountEndsAt" label="Akcija važi do" error={err("discountEndsAt")}>
              <Input id="discountEndsAt" type="datetime-local" {...register("discountEndsAt")} aria-invalid={!!errors.discountEndsAt} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skladište i garancija</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Field id="warrantyMonths" label="Garancija (mjeseci)" error={err("warrantyMonths")}>
              <Input id="warrantyMonths" inputMode="numeric" {...register("warrantyMonths")} aria-invalid={!!errors.warrantyMonths} />
            </Field>
            <Field id="weightKg" label="Težina (kg)" error={err("weightKg")}>
              <Input id="weightKg" inputMode="decimal" {...register("weightKg")} aria-invalid={!!errors.weightKg} />
            </Field>
            <Field id="lowStockThreshold" label="Prag „malo robe“" error={err("lowStockThreshold")}>
              <Input
                id="lowStockThreshold"
                inputMode="numeric"
                placeholder="opšti"
                {...register("lowStockThreshold")}
                aria-invalid={!!errors.lowStockThreshold}
              />
            </Field>
            <label className="flex items-start gap-2 text-sm sm:col-span-3">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" disabled={serialLocked} {...register("trackSerial")} />
              <span>
                Praćenje po serijskom broju (IMEI)
                <span className="block text-xs text-muted-foreground">
                  {serialLocked
                    ? "Ne može se mijenjati dok proizvod ima zalihu."
                    : "Svaki komad se prima, prodaje i vraća sa svojim serijskim brojem."}
                </span>
              </span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Karakteristike</CardTitle>
            <CardDescription>Npr. „Dijagonala“ — „55 inča“.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {attributes.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input placeholder="Naziv" aria-label={`Naziv karakteristike ${i + 1}`} {...register(`attributes.${i}.key`)} />
                <Input placeholder="Vrijednost" aria-label={`Vrijednost karakteristike ${i + 1}`} {...register(`attributes.${i}.value`)} />
                <Button type="button" variant="ghost" size="icon" aria-label="Ukloni karakteristiku" onClick={() => attributes.remove(i)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" className="self-start" onClick={() => attributes.append({ key: "", value: "" })}>
              <Plus /> Dodaj karakteristiku
            </Button>
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Čuvanje…" : product ? "Sačuvaj izmjene" : "Kreiraj proizvod"}
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => router.back()}>
            Odustani
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  wide,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "flex flex-col gap-1.5 sm:col-span-full" : "flex flex-col gap-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
