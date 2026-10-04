import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, sellerLine } from "@/components/shop/legal-page";
import { money } from "@/lib/format";
import { shopInfo } from "@/lib/shop-api";

export const metadata: Metadata = {
  title: "Uslovi korišćenja i kupovine",
  alternates: { canonical: "/uslovi-koriscenja" },
};

const UPDATED = "04.10.2026.";

export default async function TermsPage() {
  const info = await shopInfo();
  const free = info?.freeShippingFrom ? Number(info.freeShippingFrom) : null;
  const contact = [info?.email, info?.phone].filter(Boolean).join(" ili ");
  return (
    <LegalPage
      title="Uslovi korišćenja i kupovine"
      updated={UPDATED}
      sections={[
        {
          heading: "Prodavac",
          body: [
            <p key="a">
              Internet prodavnicu vodi {sellerLine(info)}. Kontakt: {contact || "podaci navedeni na sajtu"}.
            </p>,
          ],
        },
        {
          heading: "Nalog",
          body: [
            <p key="a">
              Za poručivanje je potreban nalog. Odgovorni ste za tačnost podataka i za čuvanje lozinke; ako posumnjate da je
              neko drugi koristi, promijenite je ili zatražite novu preko „Zaboravili ste lozinku?“.
            </p>,
          ],
        },
        {
          heading: "Cijene i narudžba",
          body: [
            <p key="a">
              Cijene su u eurima i sadrže PDV. Važi cijena prikazana u trenutku potvrde narudžbe; akcijska cijena važi do
              navedenog datuma ili dok traju zalihe. Narudžbom proizvode rezervišemo za vas, a ugovor je zaključen kada
              narudžbu potvrdimo — o tome dobijate email sa računom.
            </p>,
            <p key="b">
              Ako proizvoda nestane ili je cijena očigledno pogrešno objavljena, javićemo vam se prije potvrde; narudžbu
              tada možete izmijeniti ili otkazati bez troškova.
            </p>,
          ],
        },
        {
          heading: "Plaćanje",
          body: [
            <p key="a">
              Plaćate pouzećem (kuriru ili pri preuzimanju u prodavnici) ili uplatom na žiro račun; podatke za uplatu
              šaljemo emailom uz račun.
            </p>,
          ],
        },
        {
          heading: "Dostava i preuzimanje",
          body: [
            <p key="a">
              {info?.pickupPoints.length
                ? `Narudžbu možete besplatno preuzeti u prodavnici (${info.pickupPoints.map((p) => p.name).join(", ")}) kada vas obavijestimo da je spremna. `
                : ""}
              Dostava kurirskom službom širom Crne Gore košta {money(info?.courierFee ?? 0)}
              {free !== null ? `, a za narudžbe od ${money(free)} je besplatna` : ""}. Pri preuzimanju provjerite da li je
              paket oštećen.
            </p>,
          ],
        },
        {
          heading: "Odustanak od kupovine i povraćaj",
          body: [
            <p key="a">
              Od kupovine na daljinu možete odustati u roku od {info?.returnWindowDays ?? 14} dana od preuzimanja, bez
              navođenja razloga. Proizvod vratite neoštećen, sa svom opremom i dokumentima; novac vraćamo na isti način na
              koji ste platili, nakon pregleda robe. Troškove vraćanja robe snosi kupac, osim kada je proizvod neispravan
              ili pogrešno isporučen. Više na stranici <Link href="/kupovina#povracaj">Kupovina</Link>.
            </p>,
          ],
        },
        {
          heading: "Reklamacije i garancija",
          body: [
            <p key="a">
              Za nedostatke proizvoda odgovaramo u skladu sa propisima o zaštiti potrošača. Reklamaciju podnesite u
              prodavnici ili na {contact || "kontakt naveden na sajtu"}, uz račun; odgovaramo u zakonskom roku. Proizvodi
              sa garancijom proizvođača servisiraju se preko ovlašćenog servisa uz garantni list.
            </p>,
          ],
        },
        {
          heading: "Ocjene proizvoda",
          body: [
            <p key="a">
              Ocjenu može ostaviti samo kupac koji je proizvod primio. Ocjene objavljujemo nakon provjere; ne objavljujemo
              uvredljiv sadržaj, lične podatke ni reklame.
            </p>,
          ],
        },
        {
          heading: "Privatnost",
          body: [
            <p key="a">
              Kako obrađujemo podatke, opisano je u <Link href="/politika-privatnosti">Politici privatnosti</Link>.
            </p>,
          ],
        },
      ]}
    />
  );
}
