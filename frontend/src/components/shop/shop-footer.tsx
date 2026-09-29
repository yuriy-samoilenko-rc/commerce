import Link from "next/link";
import type { ShopInfo } from "@/lib/backend-types";

export function ShopFooter({ info }: { info: ShopInfo | null }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto bg-shop-ink text-[#c9d6ec]">
      <div className="grid gap-10 px-4 py-12 text-[15px] sm:grid-cols-2 lg:grid-cols-4 lg:px-20 lg:py-14">
        <div className="flex flex-col gap-3">
          <span className="font-display text-xl font-bold text-white">{info?.name ?? "TechStore"}</span>
          <span className="leading-relaxed">
            {info?.legalName}
            {info?.address && (
              <>
                <br />
                {info.address}
              </>
            )}
            {info?.taxId && (
              <>
                <br />
                PIB {info.taxId}
              </>
            )}
          </span>
        </div>
        <nav aria-label="Kupovina" className="flex flex-col gap-2.5">
          <strong className="text-white">Kupovina</strong>
          <Link href="/kupovina#kako-kupiti" className="text-[#c9d6ec] hover:text-white">Kako kupiti</Link>
          <Link href="/kupovina#dostava" className="text-[#c9d6ec] hover:text-white">Dostava i plaćanje</Link>
          <Link href="/kupovina#povracaj" className="text-[#c9d6ec] hover:text-white">Povraćaj robe</Link>
          <Link href="/kupovina#garancija" className="text-[#c9d6ec] hover:text-white">Garancija i servis</Link>
        </nav>
        <nav aria-label="Moj nalog" className="flex flex-col gap-2.5">
          <strong className="text-white">Moj nalog</strong>
          <Link href="/nalog/prijava" className="text-[#c9d6ec] hover:text-white">Prijava i registracija</Link>
          <Link href="/nalog/narudzbe" className="text-[#c9d6ec] hover:text-white">Moje narudžbe</Link>
          <Link href="/nalog/lista-zelja" className="text-[#c9d6ec] hover:text-white">Lista želja</Link>
        </nav>
        <div className="flex flex-col gap-2.5">
          <strong className="text-white">Prodavnice</strong>
          {info?.pickupPoints.map((p) => (
            <span key={p.id}>
              {p.name}
              {p.address && ` · ${p.address}`}
            </span>
          ))}
          {(info?.phone || info?.email) && <span>{[info.phone, info.email].filter(Boolean).join(" · ")}</span>}
        </div>
      </div>
      <div className="flex flex-col justify-between gap-2 border-t border-[#22375a] px-4 py-6 text-[13px] text-[#9fb3d9] sm:flex-row lg:px-20">
        <span>
          © {year} {info?.name ?? "TechStore"}. Sve cijene su u eurima, sa PDV-om.
        </span>
        <Link href="/prijava" className="text-[#9fb3d9] hover:text-white">
          Za zaposlene
        </Link>
      </div>
    </footer>
  );
}
