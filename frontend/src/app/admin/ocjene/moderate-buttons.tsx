"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

/** Approve publishes the review and updates the product's rating; reject hides it. */
export function ModerateButtons({ id, status }: { id: string; status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (action: "approve" | "reject") => {
    setBusy(true);
    try {
      await api(`/admin/reviews/${id}/${action}`, { method: "POST" });
      toast.success(action === "approve" ? "Ocjena je objavljena." : "Ocjena je odbijena.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex gap-2">
      {status !== "APPROVED" && (
        <Button size="sm" disabled={busy} onClick={() => run("approve")}>
          Objavi
        </Button>
      )}
      {status !== "REJECTED" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run("reject")}>
          Odbij
        </Button>
      )}
    </div>
  );
}
