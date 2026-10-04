/** Layout of the legal pages: a title, the date of the version and numbered sections. */
export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { heading: string; body: React.ReactNode[] }[];
}) {
  return (
    <main className="flex max-w-4xl flex-col gap-6 px-4 pt-6 pb-16 lg:px-20 lg:pt-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        <span className="text-sm text-shop-muted">Važi od {updated}</span>
      </div>
      <div className="flex flex-col gap-6 rounded-3xl border border-shop-line bg-white p-6 md:p-10">
        {sections.map((s, i) => (
          <section key={s.heading} className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold">
              {i + 1}. {s.heading}
            </h2>
            {s.body.map((p, j) => (
              <div key={j} className="text-[15px] leading-relaxed text-shop-body [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
                {p}
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}

/** "TechStore d.o.o., Bulevar…, PIB 03187456" from the settings, skipping what is not filled in. */
export function sellerLine(info: { name: string; legalName: string | null; address: string | null; taxId: string | null } | null) {
  if (!info) return "TechStore";
  return [info.legalName ?? info.name, info.address, info.taxId && `PIB ${info.taxId}`].filter(Boolean).join(", ");
}
