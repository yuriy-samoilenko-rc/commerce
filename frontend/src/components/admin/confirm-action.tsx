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
import { api, ApiError } from "@/lib/api";

/** A button that asks first, then POSTs (or `method`) to `path` and refreshes the page. */
export function ConfirmAction({
  path,
  label,
  title,
  description,
  done,
  destructive,
  method = "POST",
  then,
}: {
  path: string;
  label: string;
  title: string;
  description: string;
  /** Toast after success. */
  done: string;
  destructive?: boolean;
  method?: "POST" | "DELETE";
  /** Where to go after success instead of refreshing (e.g. the list after a delete). */
  then?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await api(path, { method });
      toast.success(done);
      setOpen(false);
      if (then) router.push(then);
      else router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
      // Somebody else may have changed the document meanwhile.
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const variant = destructive ? "destructive" : "default";
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Nazad</DialogClose>
            <Button variant={variant} disabled={busy} onClick={run}>
              {label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
