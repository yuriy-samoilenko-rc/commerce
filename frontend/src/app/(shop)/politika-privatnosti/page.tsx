import type { Metadata } from "next";
import { LegalPage, sellerLine } from "@/components/shop/legal-page";
import { shopInfo } from "@/lib/shop-api";

export const metadata: Metadata = {
  title: "Politika privatnosti",
  alternates: { canonical: "/politika-privatnosti" },
};

const UPDATED = "04.10.2026.";

export default async function PrivacyPage() {
  const info = await shopInfo();
  const contact = [info?.email, info?.phone].filter(Boolean).join(", telefon ");
  return (
    <LegalPage
      title="Politika privatnosti"
      updated={UPDATED}
      sections={[
        {
          heading: "Ko obrađuje vaše podatke",
          body: [
            <p key="a">
              Rukovalac podacima o ličnosti je {sellerLine(info)}. Za sva pitanja o vašim podacima pišite nam na{" "}
              {contact || "adresu navedenu na sajtu"}.
            </p>,
          ],
        },
        {
          heading: "Koje podatke prikupljamo",
          body: [
            <ul key="a">
              <li>Nalog: ime i prezime, email i lozinku (čuvamo samo njen šifrovani zapis), a po želji telefon i adresu za dostavu.</li>
              <li>Narudžbe: ime, telefon, email, adresu dostave ili izabranu prodavnicu, naručene proizvode, način plaćanja i napomenu.</li>
              <li>Ocjene proizvoda: ocjenu i tekst; uz ocjenu se javno prikazuje samo ime i početno slovo prezimena.</li>
              <li>Tehnički podaci: kolačić za prijavu i podaci u memoriji pregledača (korpa, lista želja, poređenje) — vidi tačku 7.</li>
            </ul>,
          ],
        },
        {
          heading: "Zašto ih obrađujemo",
          body: [
            <ul key="a">
              <li>da bismo izvršili narudžbu: pripremili robu, isporučili je ili vam je predali u prodavnici;</li>
              <li>da bismo izdali račun, otpremnicu i garantni list i ispunili obaveze iz poreskih i računovodstvenih propisa;</li>
              <li>da bismo riješili povraćaj, reklamaciju ili garantni slučaj;</li>
              <li>da bismo vam slali obavještenja o narudžbi i, na vaš zahtjev, link za novu lozinku.</li>
            </ul>,
            <p key="b">Podatke ne prodajemo i ne koristimo ih za reklame niti za praćenje ponašanja na drugim sajtovima.</p>,
          ],
        },
        {
          heading: "Kome ih dostavljamo",
          body: [
            <p key="a">
              Kurirskoj službi dostavljamo ime, adresu i telefon, samo kada izaberete dostavu na adresu. Emailove šaljemo
              preko pružaoca usluge elektronske pošte. Državnim organima podatke dajemo samo kada to zakon nalaže.
            </p>,
          ],
        },
        {
          heading: "Koliko ih čuvamo",
          body: [
            <p key="a">
              Račune i druge dokumente čuvamo onoliko koliko propisuju računovodstveni i poreski propisi. Podatke naloga
              čuvamo dok nalog postoji; kada zatražite brisanje, brišemo ih osim onih koje smo po zakonu dužni da čuvamo.
            </p>,
          ],
        },
        {
          heading: "Vaša prava",
          body: [
            <p key="a">
              Imate pravo da tražite pristup svojim podacima, njihovu ispravku ili brisanje, ograničenje obrade i prenos
              podataka, kao i da uložite prigovor na obradu. Dio podataka možete sami izmijeniti u svom nalogu, u odjeljku
              „Lični podaci i adresa“. Ako smatrate da su vaša prava povrijeđena, možete se obratiti Agenciji za zaštitu
              ličnih podataka i slobodan pristup informacijama.
            </p>,
          ],
        },
        {
          heading: "Kolačići i memorija pregledača",
          body: [
            <p key="a">Koristimo samo ono što je neophodno da prodavnica radi:</p>,
            <ul key="b">
              <li>kolačić prijave (ts_session) — čuva prijavu do jednog dana; nedostupan je skriptama na stranici;</li>
              <li>memoriju pregledača za korpu, listu želja gosta, poređenje proizvoda i zapis da ste pročitali obavještenje o kolačićima.</li>
            </ul>,
            <p key="c">Ne koristimo analitičke ni reklamne kolačiće niti alate trećih strana za praćenje.</p>,
          ],
        },
        {
          heading: "Izmjene",
          body: [
            <p key="a">
              Kada promijenimo ovu politiku, novu verziju objavljujemo na ovoj stranici sa datumom od kada važi.
            </p>,
          ],
        },
      ]}
    />
  );
}
