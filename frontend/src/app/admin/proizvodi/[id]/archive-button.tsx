"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

/** Products are never deleted (orders and documents refer to them): they are archived. */
export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await api(archived ? `/admin/products/${id}/restore` : `/admin/products/${id}`, {
        method: archived ? "POST" : "DELETE",
      });
      toast.success(archived ? "Proizvod je vraćen u prodaju." : "Proizvod je arhiviran i više se ne prodaje.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={archived ? "outline" : "destructive"} disabled={busy} onClick={toggle}>
      {archived ? "Vrati u prodaju" : "Arhiviraj"}
    </Button>
  );
}
