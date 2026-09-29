"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";

/** A customer may cancel until the warehouse starts picking. */
export function CancelOrder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 rounded-2xl border-[1.5px] border-shop-field bg-white font-bold text-shop-sale hover:border-shop-sale"
      >
        Otkaži narudžbu
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="shop font-shop">
          <DialogHeader>
            <DialogTitle>Otkazati narudžbu?</DialogTitle>
            <DialogDescription>Rezervisani proizvodi se vraćaju u prodaju. Ovo se ne može poništiti.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<button type="button" className="h-11 rounded-xl border-[1.5px] border-shop-field px-4 font-bold" />}>
              Nazad
            </DialogClose>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/orders/${orderId}/cancel`, { method: "POST", json: {} });
                  toast.success("Narudžba je otkazana.");
                  setOpen(false);
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : "Narudžba trenutno ne može da se otkaže.");
                  router.refresh();
                } finally {
                  setBusy(false);
                }
              }}
              className="h-11 rounded-xl bg-shop-sale px-4 font-bold text-white disabled:opacity-60"
            >
              Otkaži narudžbu
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
