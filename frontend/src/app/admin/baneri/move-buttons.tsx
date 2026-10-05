"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

/** Moves a banner one place up or down in the slider. */
export function MoveButtons({ ids, index, title }: { ids: string[]; index: number; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function move(by: -1 | 1) {
    const order = [...ids];
    [order[index], order[index + by]] = [order[index + by], order[index]];
    setBusy(true);
    try {
      await api("/admin/banners/order", { method: "PUT", json: { ids: order } });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex">
      <Button variant="ghost" size="icon-sm" disabled={busy || index === 0} onClick={() => move(-1)} aria-label={`Pomjeri „${title}“ gore`}>
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={busy || index === ids.length - 1}
        onClick={() => move(1)}
        aria-label={`Pomjeri „${title}“ dolje`}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}
