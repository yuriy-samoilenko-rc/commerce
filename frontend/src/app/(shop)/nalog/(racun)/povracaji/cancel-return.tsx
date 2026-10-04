"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

/** Until the goods are back, the customer may withdraw the request. */
export function CancelReturn({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/returns/${id}/cancel`, { method: "POST" });
          toast.success("Zahtjev za povraćaj je povučen.");
          router.refresh();
        } catch (e) {
          toast.error(e instanceof ApiError ? e.message : "Zahtjev trenutno ne može da se povuče.");
        } finally {
          setBusy(false);
        }
      }}
      className="h-11 self-start rounded-xl border-[1.5px] border-shop-field px-4 font-bold text-shop-sale hover:border-shop-sale disabled:opacity-60"
    >
      Povuci zahtjev
    </button>
  );
}
