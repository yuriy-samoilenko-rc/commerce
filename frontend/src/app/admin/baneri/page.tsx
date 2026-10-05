import { ImageOff } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Banner, BannerList } from "@/lib/backend-types";
import { BANNER_THEMES } from "@/lib/banner-themes";
import { date } from "@/lib/format";
import { apiServer, requireUser } from "@/lib/session";
import { BannerDialog } from "./banner-dialog";
import { MoveButtons } from "./move-buttons";

export const metadata: Metadata = { title: "Baneri" };

/** Whether the moment has passed (rendered once per request on the server). */
const passed = (iso: string | null) => iso !== null && new Date(iso).getTime() <= Date.now();

function status(b: Banner) {
  if (!b.isActive) return <Badge variant="outline">Isključen</Badge>;
  if (passed(b.endsAt)) return <Badge variant="outline">Istekao</Badge>;
  if (b.startsAt && !passed(b.startsAt)) return <Badge variant="secondary">Zakazan</Badge>;
  return <Badge>Prikazuje se</Badge>;
}

function period(b: Banner) {
  if (!b.startsAt && !b.endsAt) return "bez roka";
  // The stored end is the next midnight; people think in the last day shown.
  const last = b.endsAt ? date(new Date(new Date(b.endsAt).getTime() - 1).toISOString()) : "…";
  return `${b.startsAt ? date(b.startsAt) : "…"} – ${last}`;
}

export default async function BannersPage() {
  const user = await requireUser("/admin/baneri");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/admin");
  const { status: code, data } = await apiServer<BannerList>("/admin/banners");
  if (!data) throw new Error(`Banners failed with status ${code}`);
  const ids = data.map((b) => b.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Baneri</h1>
        <BannerDialog />
      </div>
      <p className="text-sm text-muted-foreground">
        Baneri se smjenjuju u velikom slajderu na početnoj stranici, ovim redom. Kad nijedan nije uključen, slajder sam prikazuje
        najbolje ponude sa akcije.
      </p>
      {data.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-4 text-sm text-muted-foreground">Još nema banera.</p>
          </CardContent>
        </Card>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Redoslijed banera">
          {data.map((b, i) => (
            <li key={b.id} aria-label={b.title}>
              <Card size="sm">
                <CardContent className="flex flex-wrap items-center gap-4">
                  <MoveButtons ids={ids} index={i} title={b.title} />
                  <div
                    className={`relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md ${BANNER_THEMES[b.theme].className}`}
                  >
                    {b.imageUrl ? (
                      <Image src={b.imageUrl} alt="" fill unoptimized sizes="112px" className="object-cover" />
                    ) : (
                      <ImageOff className="size-5 text-white/60" aria-label="Bez slike" />
                    )}
                  </div>
                  <div className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="font-medium">{b.title}</span>
                    {b.text && <span className="truncate text-sm text-muted-foreground">{b.text}</span>}
                    <span className="truncate text-xs text-muted-foreground">
                      {b.link} · {period(b)}
                    </span>
                  </div>
                  {status(b)}
                  <div className="flex gap-2">
                    <BannerDialog banner={b} />
                    <ConfirmAction
                      path={`/admin/banners/${b.id}`}
                      method="DELETE"
                      label="Obriši"
                      title={`Obrisati baner „${b.title}“?`}
                      description="Baner i njegova slika se trajno brišu. Da ga samo sakrijete, isključite ga."
                      done="Baner je obrisan."
                      destructive
                    />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
