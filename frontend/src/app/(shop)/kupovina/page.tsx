import type { Metadata } from "next";
import { money } from "@/lib/format";
import { shopInfo } from "@/lib/shop-api";

export const metadata: Metadata = { title: "Kupovina, dostava i povraćaj" };

/** How buying works, built from the shop's real settings (fees, stores, return period). */
export default async function BuyingInfoPage() {
  const info = await shopInfo();
  const free = info?.freeShippingFrom ? Number(info.freeShippingFrom) : null;
  const section = "flex scroll-mt-6 flex-col gap-3 rounded-3xl border border-shop-line bg-white p-6 md:p-8";
  const h2 = "font-display text-2xl font-bold tracking-tight";
  const p = "text-[15px] leading-relaxed text-shop-body";
  return (
    <main className="flex max-w-4xl flex-col gap-6 px-4 pt-6 pb-16 lg:px-20 lg:pt-10">
      <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Kupovina u TechStore-u</h1>
      <section id="kako-kupiti" className={section}>
        <h2 className={h2}>Kako kupiti</h2>
        <p className={p}>
          Izaberite proizvode i dodajte ih u korpu. U korpi se prijavite ili napravite nalog, izaberite način preuzimanja i
          plaćanja i potvrdite narudžbu. Potvrdu i sve promjene statusa dobijate emailom, a narudžbu pratite u svom nalogu.
        </p>
      </section>
      <section id="dostava" className={section}>
        <h2 className={h2}>Dostava i plaćanje</h2>
        {!!info?.pickupPoints.length && (
          <p className={p}>
            Preuzimanje u prodavnici je besplatno: {info.pickupPoints.map((s) => [s.name, s.address].filter(Boolean).join(", ")).join("; ")}.
            Javljamo vam se kada je narudžba spremna.
          </p>
        )}
        <p className={p}>
          Dostava kurirskom službom na adresu širom Crne Gore košta {money(info?.courierFee ?? 0)}
          {free !== null ? `, a za narudžbe od ${money(free)} je besplatna` : ""}.
        </p>
        <p className={p}>
          Plaćate pouzećem (gotovinom kuriru ili pri preuzimanju u prodavnici) ili uplatom na žiro račun — podatke za
          uplatu šaljemo emailom. Sve cijene su u eurima i sadrže PDV.
        </p>
      </section>
      <section id="povracaj" className={section}>
        <h2 className={h2}>Povraćaj robe</h2>
        <p className={p}>
          Proizvod možete vratiti u roku od {info?.returnWindowDays ?? 14} dana od preuzimanja. Zahtjev podnesite u svom
          nalogu, na stranici narudžbe („Vrati proizvod“), ili nam se javite; robu donesite u prodavnicu, a novac vraćamo
          nakon pregleda robe.
        </p>
      </section>
      <section id="garancija" className={section}>
        <h2 className={h2}>Garancija i servis</h2>
        <p className={p}>
          Uz proizvod dobijate račun i garantni list; oba možete preuzeti i u svom nalogu. Kvarove u garantnom roku
          rješavamo preko ovlašćenog servisa u Crnoj Gori — donesite proizvod sa garantnim listom u prodavnicu.
        </p>
        {(info?.phone || info?.email) && (
          <p className={p}>Kontakt: {[info.phone, info.email].filter(Boolean).join(" · ")}</p>
        )}
      </section>
    </main>
  );
}
