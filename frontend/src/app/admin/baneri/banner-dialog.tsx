"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { Banner } from "@/lib/backend-types";
import { BANNER_THEMES } from "@/lib/banner-themes";

/** "2026-10-04T22:00:00Z" → "2026-10-05" for a date field (local day). */
const dayInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Creates a banner, or edits one when given. The picture uploads after the text is
 * saved; dates are whole local days, from 00:00 until the end of the last day.
 */
export function BannerDialog({ banner }: { banner?: Banner }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(form: FormData) {
    const text = (k: string) => String(form.get(k) ?? "").trim();
    const start = text("startsAt");
    const end = text("endsAt");
    const json = {
      title: text("title"),
      text: text("text") || null,
      badge: text("badge") || null,
      buttonText: text("buttonText") || null,
      link: text("link"),
      theme: text("theme"),
      isActive: form.get("isActive") === "on",
      startsAt: start ? new Date(`${start}T00:00:00`).toISOString() : null,
      // "Until" includes the whole day.
      endsAt: end ? new Date(new Date(`${end}T00:00:00`).getTime() + 86_400_000).toISOString() : null,
    };
    if (!/^(\/(?!\/)\S*|https:\/\/\S+)$/.test(json.link)) {
      setError("Link je putanja u prodavnici (npr. /katalog/televizori) ili puna adresa koja počinje sa https://.");
      return;
    }
    const file = form.get("image");
    setBusy(true);
    setError(null);
    try {
      const saved = await api<Banner>(banner ? `/admin/banners/${banner.id}` : "/admin/banners", {
        method: banner ? "PATCH" : "POST",
        json,
      });
      if (file instanceof File && file.size) {
        const upload = new FormData();
        upload.append("file", file);
        await api(`/admin/banners/${saved.id}/image`, { method: "POST", body: upload });
      } else if (banner?.imageUrl && form.get("removeImage") === "on") {
        await api(`/admin/banners/${saved.id}/image`, { method: "DELETE" });
      }
      toast.success(banner ? "Baner je sačuvan." : "Baner je dodat.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
      // The text may be saved even when the picture was refused.
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const lastDay = banner?.endsAt ? dayInput(new Date(new Date(banner.endsAt).getTime() - 1).toISOString()) : "";

  return (
    <>
      <Button
        variant={banner ? "outline" : "default"}
        size={banner ? "sm" : "default"}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {banner ? "Izmijeni" : "Novi baner"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          {/* onSubmit, not action: a form action resets the fields even when saving fails. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(new FormData(e.currentTarget));
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>{banner ? banner.title : "Novi baner"}</DialogTitle>
              <DialogDescription>Prikazuje se u velikom slajderu na početnoj stranici prodavnice.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="banner-title">Naslov</Label>
                <Input id="banner-title" name="title" required maxLength={80} defaultValue={banner?.title} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="banner-text">Tekst ispod naslova</Label>
                <Input id="banner-text" name="text" maxLength={200} defaultValue={banner?.text ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="banner-badge">Oznaka iznad naslova</Label>
                <Input id="banner-badge" name="badge" maxLength={30} placeholder="npr. AKCIJA" defaultValue={banner?.badge ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="banner-button">Tekst dugmeta</Label>
                <Input id="banner-button" name="buttonText" maxLength={40} placeholder="Pogledaj" defaultValue={banner?.buttonText ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="banner-link">Link</Label>
                <Input
                  id="banner-link"
                  name="link"
                  required
                  maxLength={300}
                  placeholder="/katalog/televizori ili https://…"
                  defaultValue={banner?.link ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="banner-start">Prikazuj od</Label>
                <Input id="banner-start" name="startsAt" type="date" defaultValue={dayInput(banner?.startsAt)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="banner-end">Prikazuj do</Label>
                <Input id="banner-end" name="endsAt" type="date" defaultValue={lastDay} />
              </div>
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">Boja pozadine</legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(BANNER_THEMES).map(([key, t]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm has-checked:border-primary has-checked:ring-1 has-checked:ring-primary"
                  >
                    <input type="radio" name="theme" value={key} defaultChecked={(banner?.theme ?? "NAVY") === key} className="sr-only" />
                    <span className="size-4 rounded-full" style={{ background: t.swatch }} aria-hidden />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="banner-image">{banner?.imageUrl ? "Nova slika" : "Slika"}</Label>
              <Input id="banner-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
              <p className="text-xs text-muted-foreground">
                JPEG, PNG ili WebP do 10 MB, najbolje oko 1920×800 px. Slika pokriva cijeli baner, a tekst stoji preko nje na lijevoj strani — tamo ne stavljajte važne detalje.
              </p>
              {banner?.imageUrl && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="removeImage" className="size-4" />
                  Ukloni postojeću sliku
                </label>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={banner?.isActive ?? true} className="size-4" />
              Uključen
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Nazad</DialogClose>
              <Button type="submit" disabled={busy}>
                Sačuvaj
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
