"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { Customer, CustomerList, Order, StaffProduct, StaffProductList } from "@/lib/backend-types";
import { count, money } from "@/lib/format";
import { DELIVERY_METHOD, PAYMENT_METHOD } from "@/lib/labels";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

// Same limits as the backend's CheckoutDto.
const MAX_QTY = 100;
const MAX_LINES = 50;
// Shown before the order exists; the backend computes the real fee (orders/order-settings.ts).
const DELIVERY_FEE = { PICKUP: 0, COURIER: 10 } as const;
// A card payment needs the online checkout; a phone order is paid on delivery or by transfer.
const PAYMENT_METHODS = ["CASH_ON_DELIVERY", "BANK_TRANSFER"] as const;

const schema = z
  .object({
    customerName: z.string().trim().min(2, "Unesite ime i prezime.").max(100),
    customerPhone: z.string().trim().regex(/^\+?[0-9 ()-]{6,20}$/, "Unesite ispravan broj telefona."),
    customerEmail: z.union([z.literal(""), z.email("Unesite ispravan email.")]),
    deliveryMethod: z.enum(["PICKUP", "COURIER"]),
    deliveryAddress: z.string().trim().max(300),
    paymentMethod: z.enum(PAYMENT_METHODS),
    comment: z.string().trim().max(1000),
  })
  .refine((v) => v.deliveryMethod === "PICKUP" || v.deliveryAddress.length >= 5, {
    path: ["deliveryAddress"],
    message: "Unesite adresu za dostavu.",
  });
type Values = z.infer<typeof schema>;

interface Line {
  product: StaffProduct;
  quantity: number;
}

const price = (p: StaffProduct) => p.discountPrice ?? p.sellingPrice;
const cents = (value: string) => Math.round(Number(value) * 100);

export function NewOrderForm() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      deliveryMethod: "PICKUP",
      deliveryAddress: "",
      paymentMethod: "CASH_ON_DELIVERY",
      comment: "",
    },
  });
  const delivery = useWatch({ control, name: "deliveryMethod" });

  function add(product: StaffProduct) {
    setLines((current) => {
      const existing = current.find((l) => l.product.id === product.id);
      if (existing) return current.map((l) => (l === existing ? { ...l, quantity: Math.min(l.quantity + 1, MAX_QTY) } : l));
      return current.length >= MAX_LINES ? current : [...current, { product, quantity: 1 }];
    });
  }
  const setQuantity = (id: string, quantity: number) =>
    setLines((current) =>
      current.map((l) => (l.product.id === id ? { ...l, quantity: Math.max(1, Math.min(quantity || 1, MAX_QTY)) } : l)),
    );
  const remove = (id: string) => setLines((current) => current.filter((l) => l.product.id !== id));

  function link(c: Customer) {
    setCustomer(c);
    // Contacts come from the account and its latest order; the manager can still edit them.
    setValue("customerName", c.name, { shouldValidate: true });
    setValue("customerEmail", c.email, { shouldValidate: true });
    if (c.phone) setValue("customerPhone", c.phone, { shouldValidate: true });
    if (c.address) setValue("deliveryAddress", c.address);
  }

  const subtotal = lines.reduce((sum, l) => sum + cents(price(l.product)) * l.quantity, 0);
  const fee = DELIVERY_FEE[delivery] * 100;

  async function onSubmit(v: Values) {
    setError(null);
    if (!lines.length) {
      setError("Dodajte bar jedan proizvod.");
      return;
    }
    try {
      const order = await api<Order>("/admin/orders", {
        method: "POST",
        json: {
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
          customerName: v.customerName,
          customerPhone: v.customerPhone,
          customerEmail: v.customerEmail || undefined,
          deliveryMethod: v.deliveryMethod,
          deliveryAddress: v.deliveryMethod === "COURIER" ? v.deliveryAddress : undefined,
          paymentMethod: v.paymentMethod,
          comment: v.comment || undefined,
          userId: customer?.id,
        },
      });
      toast.success(`Narudžba br. ${order.number} je kreirana, roba je rezervisana.`);
      router.push(`/admin/narudzbe/${order.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    }
  }

  return (
    <form
      // An empty cart is reported together with the field errors, not only after they are fixed.
      onSubmit={handleSubmit(onSubmit, () => setError(lines.length ? null : "Dodajte bar jedan proizvod."))}
      noValidate className="grid items-start gap-4 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Proizvodi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ProductSearch onAdd={add} />
            {lines.length ? (
              <ul className="flex flex-col divide-y rounded-lg border" aria-label="Stavke narudžbe">
                {lines.map((l) => (
                  <li key={l.product.id} className="flex flex-wrap items-center gap-3 p-3">
                    {/* On a phone the name takes the whole first row, the controls go below it. */}
                    <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                      <div className="truncate font-medium">{l.product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.product.sku} · {money(price(l.product))} · dostupno {count(l.product.stock.available)}
                      </div>
                      {l.quantity > l.product.stock.available && (
                        <div className="text-xs text-destructive">Tražena količina je veća od dostupne.</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="icon-sm" aria-label="Manje" onClick={() => setQuantity(l.product.id, l.quantity - 1)}>
                        <Minus />
                      </Button>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_QTY}
                        value={l.quantity}
                        onChange={(e) => setQuantity(l.product.id, Number(e.target.value))}
                        aria-label={`Količina: ${l.product.name}`}
                        className="w-16 text-center tabular-nums"
                      />
                      <Button type="button" variant="outline" size="icon-sm" aria-label="Više" onClick={() => setQuantity(l.product.id, l.quantity + 1)}>
                        <Plus />
                      </Button>
                    </div>
                    <div className="ml-auto w-24 text-right font-medium tabular-nums">{money((cents(price(l.product)) * l.quantity) / 100)}</div>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Ukloni: ${l.product.name}`} onClick={() => remove(l.product.id)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Pronađite proizvod po nazivu, šifri ili bar-kodu i dodajte ga.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Kupac</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {customer ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <UserRound className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{customer.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{customer.email}</div>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Ukloni vezu sa nalogom" onClick={() => setCustomer(null)}>
                  <X />
                </Button>
              </div>
            ) : (
              <CustomerSearch onPick={link} />
            )}
            <Field id="customerName" label="Ime i prezime" error={errors.customerName?.message}>
              <Input id="customerName" autoComplete="off" {...register("customerName")} aria-invalid={!!errors.customerName} />
            </Field>
            <Field id="customerPhone" label="Telefon" error={errors.customerPhone?.message}>
              <Input id="customerPhone" type="tel" placeholder="+382 67 123 456" {...register("customerPhone")} aria-invalid={!!errors.customerPhone} />
            </Field>
            <Field id="customerEmail" label="Email (nije obavezan)" error={errors.customerEmail?.message}>
              <Input id="customerEmail" type="email" {...register("customerEmail")} aria-invalid={!!errors.customerEmail} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dostava i plaćanje</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Choice legend="Dostava" name="deliveryMethod" options={["PICKUP", "COURIER"]} labels={DELIVERY_METHOD} register={register} />
            {delivery === "COURIER" && (
              <Field id="deliveryAddress" label="Adresa za dostavu" error={errors.deliveryAddress?.message}>
                <Textarea id="deliveryAddress" rows={2} {...register("deliveryAddress")} aria-invalid={!!errors.deliveryAddress} />
              </Field>
            )}
            <Choice legend="Plaćanje" name="paymentMethod" options={PAYMENT_METHODS} labels={PAYMENT_METHOD} register={register} />
            <Field id="comment" label="Napomena" error={errors.comment?.message}>
              <Textarea id="comment" rows={2} {...register("comment")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted-foreground">Međuzbir</dt>
              <dd className="text-right tabular-nums">{money(subtotal / 100)}</dd>
              <dt className="text-muted-foreground">Dostava</dt>
              <dd className="text-right tabular-nums">{money(fee / 100)}</dd>
              <dt className="font-medium">Ukupno sa PDV-om</dt>
              <dd className="text-right font-medium tabular-nums">{money((subtotal + fee) / 100)}</dd>
            </dl>
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Kreiranje…" : "Kreiraj narudžbu"}
            </Button>
            <p className="text-xs text-muted-foreground">Cijene se preuzimaju iz kataloga u trenutku kreiranja, a roba se odmah rezerviše.</p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function ProductSearch({ onAdd }: { onAdd: (p: StaffProduct) => void }) {
  const [text, setText] = useState("");
  const search = useDebounced(text.trim());
  const results = useQuery({
    queryKey: ["admin-products", "pick", search],
    queryFn: () => api<StaffProductList>(`/admin/products?${new URLSearchParams({ search, limit: "8", sort: "name" })}`),
    enabled: search.length >= 2,
  });

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        // A scanner types the barcode and presses Enter: add the single match instead of submitting the form.
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const only = results.data?.items.length === 1 ? results.data.items[0] : undefined;
          if (only && only.stock.available > 0) {
            onAdd(only);
            setText("");
          }
        }}
        placeholder="Naziv, šifra ili bar-kod"
        aria-label="Pretraga proizvoda"
      />
      {search.length >= 2 && (
        <ul className="flex flex-col divide-y rounded-lg border" aria-label="Rezultati pretrage">
          {results.isPending && <li className="p-3 text-sm text-muted-foreground">Pretraga…</li>}
          {results.data?.items.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nema proizvoda za „{search}“.</li>}
          {results.data?.items.map((p) => {
            const out = p.stock.available <= 0;
            return (
              <li key={p.id} className="flex items-center gap-3 p-2 pl-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.sku} · {money(price(p))}
                    {p.discountPrice && <span className="ml-1 line-through">{money(p.sellingPrice)}</span>}
                  </div>
                </div>
                <span className={cn("text-xs whitespace-nowrap", out ? "text-destructive" : "text-muted-foreground")}>
                  {out ? "Nema na stanju" : `Dostupno ${count(p.stock.available)}`}
                </span>
                <Button type="button" size="sm" variant="outline" disabled={out} onClick={() => onAdd(p)} aria-label={`Dodaj: ${p.name}`}>
                  <Plus /> Dodaj
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CustomerSearch({ onPick }: { onPick: (c: Customer) => void }) {
  const [text, setText] = useState("");
  const search = useDebounced(text.trim());
  const results = useQuery({
    queryKey: ["admin-customers", search],
    queryFn: () => api<CustomerList>(`/admin/customers?${new URLSearchParams({ search, limit: "5" })}`),
    enabled: search.length >= 2,
  });

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        placeholder="Poveži sa nalogom: ime ili email"
        aria-label="Pretraga kupaca"
      />
      {search.length >= 2 && (
        <ul className="flex flex-col divide-y rounded-lg border" aria-label="Pronađeni kupci">
          {results.isPending && <li className="p-3 text-sm text-muted-foreground">Pretraga…</li>}
          {results.data?.items.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nema naloga za „{search}“.</li>}
          {results.data?.items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {c.email}
                  {c.phone && ` · ${c.phone}`} · narudžbi: {c.orderCount}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Choice<N extends "deliveryMethod" | "paymentMethod">({
  legend,
  name,
  options,
  labels,
  register,
}: {
  legend: string;
  name: N;
  options: readonly string[];
  labels: Record<string, string>;
  register: ReturnType<typeof useForm<Values>>["register"];
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 text-sm">
          <input type="radio" value={o} {...register(name)} className="size-4 accent-primary" />
          {labels[o]}
          {name === "deliveryMethod" && (
            <span className="text-muted-foreground">({money(DELIVERY_FEE[o as keyof typeof DELIVERY_FEE])})</span>
          )}
        </label>
      ))}
    </fieldset>
  );
}
