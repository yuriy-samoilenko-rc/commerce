"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Pencil, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { ProductImage, ProductImageList } from "@/lib/backend-types";
import { cn } from "@/lib/utils";

// The same limits as the API (product-images.service); checked here to answer at once.
const MAX_IMAGES = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

const failed = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");

/** The shop's photos of a product. The first one is the main photo (lists, cart, search). */
export function ProductImages({
  productId,
  productName,
  initial,
  canEdit,
}: {
  productId: string;
  productName: string;
  initial: ProductImageList;
  canEdit: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<ProductImage | null>(null);
  const [removing, setRemoving] = useState<ProductImage | null>(null);
  const path = `/admin/products/${productId}/images`;

  async function run(action: () => Promise<ProductImageList>, done?: string) {
    setBusy(true);
    try {
      setImages(await action());
      if (done) toast.success(done);
      router.refresh();
      return true;
    } catch (e) {
      failed(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function upload(files: File[]) {
    if (!files.length) return;
    const wrong = files.find((f) => !TYPES.includes(f.type));
    if (wrong) return toast.error(`„${wrong.name}“ nije slika u formatu JPEG, PNG ili WebP.`);
    const big = files.find((f) => f.size > MAX_BYTES);
    if (big) return toast.error(`„${big.name}“ je veća od 10 MB.`);
    const left = MAX_IMAGES - images.length;
    if (files.length > left) {
      return toast.error(`Proizvod može imati najviše ${MAX_IMAGES} slika; može se dodati još ${left}.`);
    }
    const form = new FormData();
    for (const f of files) form.append("files", f);
    void run(
      () => api<ProductImageList>(path, { method: "POST", body: form }),
      files.length === 1 ? "Slika je dodata." : `Dodato je ${files.length} slika.`,
    );
  }

  function move(from: number, to: number) {
    const ids = images.map((i) => i.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    void run(
      () => api<ProductImageList>(`${path}/order`, { method: "PUT", json: { ids } }),
      to === 0 ? "Glavna slika je promijenjena." : undefined,
    );
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (canEdit && !busy) upload([...e.dataTransfer.files]);
  }

  const full = images.length >= MAX_IMAGES;
  return (
    <Card
      onDragOver={canEdit ? (e) => (e.preventDefault(), setDragging(true)) : undefined}
      onDragLeave={canEdit ? () => setDragging(false) : undefined}
      onDrop={canEdit ? onDrop : undefined}
      className={cn(dragging && "ring-2 ring-primary")}
    >
      <CardHeader>
        <CardTitle>Slike</CardTitle>
        <CardDescription>
          {images.length} od {MAX_IMAGES}
          {canEdit && " · prva slika je glavna; JPEG, PNG ili WebP do 10 MB"}
        </CardDescription>
        {canEdit && (
          <CardAction>
            <Button variant="outline" disabled={busy || full} onClick={() => input.current?.click()}>
              <ImagePlus /> Dodaj slike
            </Button>
            <input
              ref={input}
              type="file"
              accept={TYPES.join(",")}
              multiple
              hidden
              aria-label="Izaberite slike"
              onChange={(e) => {
                upload([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {canEdit
              ? "Proizvod još nema slika. Prevucite ih ovdje ili kliknite „Dodaj slike“."
              : "Proizvod još nema slika."}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Slike proizvoda">
            {images.map((image, i) => (
              <li key={image.id} className="flex flex-col gap-2">
                <a
                  href={image.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block aspect-square overflow-hidden rounded-lg border bg-muted"
                >
                  <Image
                    src={image.thumbUrl}
                    alt={image.alt ?? `${productName}, slika ${i + 1}`}
                    fill
                    unoptimized
                    sizes="200px"
                    className="object-contain"
                  />
                  {i === 0 && <Badge className="absolute top-2 left-2">Glavna</Badge>}
                </a>
                <p className="truncate text-xs text-muted-foreground" title={image.alt ?? undefined}>
                  {image.alt ?? "Bez opisa"}
                </p>
                {canEdit && (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      disabled={busy || i === 0}
                      onClick={() => move(i, i - 1)}
                      aria-label="Pomjeri lijevo"
                      title="Pomjeri lijevo"
                    >
                      <ArrowLeft />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      disabled={busy || i === images.length - 1}
                      onClick={() => move(i, i + 1)}
                      aria-label="Pomjeri desno"
                      title="Pomjeri desno"
                    >
                      <ArrowRight />
                    </Button>
                    {i > 0 && (
                      <Button
                        size="icon-sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => move(i, 0)}
                        aria-label="Postavi kao glavnu"
                        title="Postavi kao glavnu"
                      >
                        <Star />
                      </Button>
                    )}
                    <Button
                      size="icon-sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setEditing(image)}
                      aria-label="Opis slike"
                      title="Opis slike"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setRemoving(image)}
                      aria-label="Obriši sliku"
                      title="Obriši sliku"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const alt = String(new FormData(e.currentTarget).get("alt") ?? "");
              const ok = await run(
                () => api<ProductImageList>(`${path}/${editing!.id}`, { method: "PATCH", json: { alt } }),
                "Opis slike je sačuvan.",
              );
              if (ok) setEditing(null);
            }}
          >
            <DialogHeader>
              <DialogTitle>Opis slike</DialogTitle>
              <DialogDescription>
                Kratak opis onoga što se vidi na slici. Čitaju ga čitači ekrana i pretraživači.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="image-alt">Opis</Label>
              <Input
                id="image-alt"
                name="alt"
                maxLength={200}
                defaultValue={editing?.alt ?? ""}
                placeholder={`${productName}, pogled sprijeda`}
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Nazad</DialogClose>
              <Button type="submit" disabled={busy}>
                Sačuvaj
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Obrisati sliku?</DialogTitle>
            <DialogDescription>
              Slika se uklanja iz prodavnice i ne može se vratiti.
              {removing && images[0]?.id === removing.id && images.length > 1 && " Glavna postaje sljedeća slika."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Nazad</DialogClose>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                const ok = await run(
                  () => api<ProductImageList>(`${path}/${removing!.id}`, { method: "DELETE" }),
                  "Slika je obrisana.",
                );
                if (ok) setRemoving(null);
              }}
            >
              Obriši sliku
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
