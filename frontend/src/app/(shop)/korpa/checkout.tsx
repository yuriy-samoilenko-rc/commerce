"use client";

import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthForm } from "@/components/shop/auth-form";
import { FreeShippingBar, ProductPhoto } from "@/components/shop/bits";
import { productHref } from "@/lib/shop-links";
import { useShop } from "@/components/shop/shop-provider";
import { api, ApiError } from "@/lib/api";
import type { CustomerOrder, PickupPoint, Recommendations } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { courierQuote, useCart } from "@/lib/shop-products";
import { cart, MAX_QTY } from "@/lib/shop-store";
import { cn } from "@/lib/utils";

const field =
  "h-12 w-full rounded-xl border-[1.5px] border-shop-field bg-white px-3.5 text-[15px] font-normal text-shop-ink outline-none focus:border-shop-blue";
const label = "flex flex-col gap-1.5 text-sm font-semibold";

function Choice({
  name,
  checked,
  onChange,
  title,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3.5 rounded-2xl border-[1.5px] bg-white p-4",
        checked ? "border-shop-blue bg-shop-tint/40" : "border-shop-field",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-0.5 size-5 accent-shop-blue" />
      <span className="flex flex-col gap-1">
        <strong className="text-[15px]">{title}</strong>
        <span className="text-sm text-shop-muted">{hint}</span>
      </span>
    </label>
  );
}

export function Checkout({ pickupPoints, returnDays }: { pickupPoints: PickupPoint[]; returnDays: number }) {
  const router = useRouter();
  const { customer, delivery } = useShop();
  const { items, lines, loading, pieces, subtotal } = useCart();
  const [method, setMethod] = useState<"PICKUP" | "COURIER">(pickupPoints.length ? "PICKUP" : "COURIER");
  const [pickupId, setPickupId] = useState(pickupPoints[0]?.id ?? "");
  const [payment, setPayment] = useState<"CASH_ON_DELIVERY" | "BANK_TRANSFER">("CASH_ON_DELIVERY");
  const [busy, setBusy] = useState(false);

  const first = items[0]?.product.id;
  const suggestions = useQuery({
    queryKey: ["recommendations", first],
    enabled: !!first,
    queryFn: () => api<Recommendations>(`/products/${first}/recommendations`),
    select: (r) => r.addOns.filter((p) => !lines.some((l) => l.productId === p.id)).slice(0, 3),
  });

  const quote = courierQuote(subtotal, delivery.courierFee, delivery.freeShippingFrom);
  const deliveryFee = method === "PICKUP" ? 0 : quote.fee;
  const total = subtotal + deliveryFee;

  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-white" />;
  if (!items.length)
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-shop-line bg-white p-12 text-center">
        <p className="text-lg text-shop-muted">Korpa je prazna.</p>
        <Link href="/katalog" className="flex h-12 items-center rounded-xl bg-shop-blue px-6 font-bold text-white hover:bg-shop-blue-dark">
          Pogledajte ponudu
        </Link>
      </div>
    );

  async function placeOrder(form: FormData) {
    const get = (k: string) => String(form.get(k) ?? "").trim();
    const address = [get("street"), [get("postal"), get("city")].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    setBusy(true);
    try {
      if (form.get("save") === "on") {
        await api("/auth/me", {
          method: "PATCH",
          json: { phone: get("phone"), ...(method === "COURIER" && { deliveryAddress: address }) },
        }).catch(() => null);
      }
      const order = await api<CustomerOrder>("/orders", {
        method: "POST",
        json: {
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          customerName: get("name"),
          customerPhone: get("phone"),
          deliveryMethod: method,
          ...(method === "PICKUP" ? (pickupId ? { pickupWarehouseId: pickupId } : {}) : { deliveryAddress: address }),
          paymentMethod: payment,
          comment: get("comment") || undefined,
        },
      });
      cart.clear();
      router.push(`/nalog/narudzbe/${order.id}?nova=1`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Narudžba trenutno ne može da se pošalje. Pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  }

  // The saved address is one line; offered back in the street field.
  const savedAddress = customer?.deliveryAddress ?? "";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
      <div className="flex flex-col gap-6 lg:col-span-8">
        <section aria-label="Proizvodi u korpi" className="flex flex-col rounded-3xl border border-shop-line bg-white px-4 py-2 md:px-7">
          {items.map(({ product, quantity, total: lineTotal }) => (
            <div key={product.id} className="flex flex-wrap items-center gap-4 border-b border-[#e6ecf5] py-5 last:border-0 sm:flex-nowrap sm:gap-5">
              <Link href={productHref(product)} className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-shop-ground sm:size-22">
                <ProductPhoto product={product} sizes="88px" />
              </Link>
              <div className="flex min-w-0 grow basis-40 flex-col gap-1">
                <Link href={productHref(product)} className="font-semibold text-shop-ink hover:text-shop-blue">
                  {product.name}
                </Link>
                <span className="text-sm text-shop-muted">{money(product.shopPrice)} / kom.</span>
                {!product.inStock && <span className="text-sm font-semibold text-shop-sale">Trenutno nema na stanju</span>}
              </div>
              <div role="group" aria-label={`Količina: ${product.name}`} className="flex h-11 items-center overflow-hidden rounded-xl border-[1.5px] border-shop-field">
                <button type="button" onClick={() => cart.setQuantity(product.id, quantity - 1)} aria-label="Manje" className="flex size-11 items-center justify-center hover:bg-shop-ground">
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center font-bold">{quantity}</span>
                <button
                  type="button"
                  onClick={() => cart.setQuantity(product.id, quantity + 1)}
                  disabled={quantity >= MAX_QTY}
                  aria-label="Više"
                  className="flex size-11 items-center justify-center hover:bg-shop-ground disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <span className="ml-auto w-28 text-right font-display text-lg font-bold">{money(lineTotal)}</span>
              <button
                type="button"
                onClick={() => cart.remove(product.id)}
                aria-label={`Ukloni ${product.name} iz korpe`}
                className="flex size-11 items-center justify-center rounded-xl text-shop-muted hover:bg-shop-ground hover:text-shop-sale"
              >
                <Trash2 className="size-5" />
              </button>
            </div>
          ))}
        </section>

        {!!suggestions.data?.length && (
          <section aria-label="Preporuke" className="flex flex-col gap-4 rounded-3xl border border-shop-line bg-white p-5 md:p-7">
            <h2 className="font-display text-xl font-bold tracking-tight">Često se kupuje uz vašu korpu</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {suggestions.data.map((p) => (
                <div key={p.id} className="flex items-center gap-3.5 rounded-[18px] border border-shop-line p-3">
                  <span className="relative size-[72px] shrink-0 overflow-hidden rounded-xl bg-shop-ground">
                    <ProductPhoto product={p} sizes="72px" />
                  </span>
                  <span className="flex min-w-0 grow flex-col gap-1">
                    <span className="text-sm leading-snug font-semibold">{p.name}</span>
                    <span className="text-[15px] font-bold">{money(p.shopPrice)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => cart.add(p.id)}
                    aria-label={`Dodaj ${p.name} u korpu`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-shop-tint text-shop-blue hover:bg-[#d6e2ff]"
                  >
                    <Plus className="size-[18px]" strokeWidth={2.4} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-5 rounded-3xl border border-shop-line bg-white p-5 md:p-7">
          <h2 className="font-display text-[22px] font-bold tracking-tight">Vaši podaci</h2>
          {!customer ? (
            <div className="flex flex-col gap-4">
              <p className="text-[15px] text-shop-muted">
                Za poručivanje se prijavite ili napravite nalog — tako pratite narudžbu i preuzimate račun i garantni list.
              </p>
              <div className="max-w-md">
                <AuthForm />
              </div>
            </div>
          ) : (
            <form id="checkout-form" action={placeOrder} className="flex flex-col gap-5">
              <div className="grid gap-4 md:grid-cols-3">
                <label className={label}>
                  Ime i prezime
                  <input name="name" required minLength={2} maxLength={100} defaultValue={customer.name} autoComplete="name" className={field} />
                </label>
                <label className={label}>
                  Telefon
                  <input
                    name="phone"
                    type="tel"
                    required
                    pattern="\+?[0-9 ()\-]{6,20}"
                    title="Broj telefona, npr. +382 67 123 456"
                    defaultValue={customer.phone ?? ""}
                    placeholder="+382 67 123 456"
                    autoComplete="tel"
                    className={field}
                  />
                </label>
                <label className={label}>
                  Email
                  <input value={customer.email} readOnly className={cn(field, "bg-shop-ground text-shop-muted")} />
                </label>
              </div>

              <fieldset className="flex flex-col gap-3">
                <legend className="pb-3 text-base font-bold">Način preuzimanja</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  {pickupPoints.length > 0 && (
                    <Choice
                      name="delivery"
                      checked={method === "PICKUP"}
                      onChange={() => setMethod("PICKUP")}
                      title="Preuzimanje u prodavnici"
                      hint={`${pickupPoints.map((p) => p.name).join(" ili ")} · besplatno`}
                    />
                  )}
                  <Choice
                    name="delivery"
                    checked={method === "COURIER"}
                    onChange={() => setMethod("COURIER")}
                    title="Dostava na adresu"
                    hint={`Kurirska služba, cijela Crna Gora · ${quote.free ? "besplatno" : money(delivery.courierFee)}`}
                  />
                </div>
                {method === "PICKUP" && pickupPoints.length > 1 && (
                  <label className={cn(label, "max-w-md")}>
                    Prodavnica
                    <select value={pickupId} onChange={(e) => setPickupId(e.target.value)} className={field}>
                      {pickupPoints.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.address ? ` — ${p.address}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {method === "COURIER" && (
                  <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
                    <label className={label}>
                      Adresa
                      <input name="street" required minLength={5} maxLength={200} defaultValue={savedAddress} autoComplete="street-address" className={field} />
                    </label>
                    <label className={label}>
                      Grad
                      <input name="city" maxLength={60} autoComplete="address-level2" placeholder="Podgorica" className={field} />
                    </label>
                    <label className={label}>
                      Poštanski broj
                      <input name="postal" maxLength={10} autoComplete="postal-code" placeholder="81000" className={field} />
                    </label>
                  </div>
                )}
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="pb-3 text-base font-bold">Način plaćanja</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  <Choice
                    name="payment"
                    checked={payment === "CASH_ON_DELIVERY"}
                    onChange={() => setPayment("CASH_ON_DELIVERY")}
                    title={method === "PICKUP" ? "Plaćanje pri preuzimanju" : "Plaćanje pouzećem"}
                    hint={method === "PICKUP" ? "Plaćate kada preuzmete robu" : "Gotovinom kuriru pri dostavi"}
                  />
                  <Choice
                    name="payment"
                    checked={payment === "BANK_TRANSFER"}
                    onChange={() => setPayment("BANK_TRANSFER")}
                    title="Uplata na žiro račun"
                    hint="Podatke za uplatu šaljemo emailom uz račun"
                  />
                </div>
              </fieldset>

              <label className={label}>
                Napomena (nije obavezno)
                <textarea name="comment" rows={3} maxLength={1000} placeholder="Npr. pozovite prije dostave" className={cn(field, "h-auto py-3")} />
              </label>
              <label className="flex items-center gap-3 text-[15px]">
                <input type="checkbox" name="save" defaultChecked={!customer.phone} className="size-5 accent-shop-blue" />
                Sačuvaj telefon{method === "COURIER" ? " i adresu" : ""} za sljedeću kupovinu
              </label>
            </form>
          )}
        </section>
      </div>

      <aside aria-label="Pregled narudžbe" className="flex flex-col gap-4 rounded-3xl border border-shop-line bg-white p-5 md:p-7 lg:sticky lg:top-6 lg:col-span-4">
        <h2 className="font-display text-[22px] font-bold tracking-tight">Pregled narudžbe</h2>
        {method === "COURIER" && (
          <FreeShippingBar subtotal={subtotal} courierFee={delivery.courierFee} freeShippingFrom={delivery.freeShippingFrom} />
        )}
        <dl className="flex flex-col gap-3 text-[15px]">
          <div className="flex justify-between">
            <dt className="text-shop-muted">Proizvodi ({pieces} kom.)</dt>
            <dd className="font-semibold">{money(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-shop-muted">Dostava</dt>
            <dd className="font-semibold">{deliveryFee ? money(deliveryFee) : "Besplatno"}</dd>
          </div>
        </dl>
        <div className="flex items-baseline justify-between border-t border-[#e6ecf5] pt-4">
          <span className="text-[17px] font-bold">Ukupno</span>
          <span className="font-display text-3xl font-bold tracking-tight">{money(total)}</span>
        </div>
        <span className="-mt-2 text-sm text-shop-muted">Cijene sadrže PDV.</span>
        <button
          type="submit"
          form="checkout-form"
          disabled={!customer || busy}
          className="h-14 rounded-2xl bg-shop-blue text-[17px] font-bold text-white hover:bg-shop-blue-dark disabled:opacity-50"
        >
          {busy ? "Šaljemo…" : "Potvrdi narudžbu"}
        </button>
        {!customer && <span className="text-sm text-shop-muted">Prijavite se da biste potvrdili narudžbu.</span>}
        <p className="text-[13px] leading-normal text-shop-muted">
          Potvrdom prihvatate <Link href="/kupovina">uslove kupovine</Link>. Račun i garantni list dobijate uz proizvod.
        </p>
        <div className="flex items-center gap-3 rounded-2xl bg-shop-tint p-3.5 text-sm text-shop-navy">
          <ShieldCheck className="size-[22px] shrink-0" />
          Povraćaj robe u roku od {returnDays} dana od preuzimanja.
        </div>
      </aside>
    </div>
  );
}
