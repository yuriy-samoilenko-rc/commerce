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
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { Order, Role } from "@/lib/backend-types";

type OrderState = Pick<Order, "id" | "status" | "paymentStatus" | "paymentMethod" | "deliveryMethod">;

// Mirrors the backend rules (admin-orders.controller, orders/fulfillment services) so that
// only possible actions are offered; the backend still has the final word.
const MANAGERS: Role[] = ["ADMIN", "MANAGER"];
const WAREHOUSE: Role[] = ["ADMIN", "MANAGER", "WAREHOUSE"];
const PAYERS: Role[] = ["ADMIN", "MANAGER", "ACCOUNTANT"];
const CANCELLABLE = ["NEW", "CONFIRMED", "PICKING", "READY_TO_SHIP"];
const PAYABLE = [...CANCELLABLE, "SHIPPED", "DELIVERED"];

type Dialogs = "cancel" | "ship" | "paid" | null;

export function OrderActions({ order, role }: { order: OrderState; role: Role }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialogs>(null);

  const can = (roles: Role[]) => roles.includes(role);
  const paid = order.paymentStatus === "PAID";
  const pickup = order.deliveryMethod === "PICKUP";
  const cod = order.paymentMethod === "CASH_ON_DELIVERY";

  async function run(action: string, done: string, json?: unknown) {
    setBusy(true);
    try {
      await api(`/admin/orders/${order.id}/${action}`, { method: "POST", json: json ?? {} });
      toast.success(done);
      setDialog(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setBusy(false);
      // Also after a conflict: somebody else may have moved the order meanwhile.
      router.refresh();
    }
  }

  const buttons: React.ReactNode[] = [];
  if (order.status === "NEW" && can(MANAGERS)) {
    buttons.push(
      <Button key="confirm" disabled={busy} onClick={() => run("confirm", "Narudžba je potvrđena, račun je izdat.")}>
        Potvrdi narudžbu
      </Button>,
    );
  }
  if (PAYABLE.includes(order.status) && !paid && can(PAYERS)) {
    buttons.push(
      <Button key="paid" variant="outline" disabled={busy} onClick={() => setDialog("paid")}>
        Evidentiraj uplatu
      </Button>,
    );
  }
  if (order.status === "CONFIRMED" && can(MANAGERS)) {
    buttons.push(
      <Button
        key="pick"
        disabled={busy || (!paid && !cod)}
        title={!paid && !cod ? "Narudžba mora biti plaćena prije pripreme." : undefined}
        onClick={() => run("start-picking", "Narudžba je poslata u pripremu.")}
      >
        Pošalji u pripremu
      </Button>,
    );
  }
  if (order.status === "READY_TO_SHIP" && can(WAREHOUSE)) {
    buttons.push(
      <Button
        key="ship"
        disabled={busy || (pickup && !paid)}
        title={pickup && !paid ? "Prije predaje kupcu evidentirajte uplatu." : undefined}
        onClick={() => setDialog("ship")}
      >
        {pickup ? "Predaj kupcu" : "Otpremi"}
      </Button>,
    );
  }
  if (order.status === "SHIPPED" && can(WAREHOUSE)) {
    buttons.push(
      <Button key="deliver" disabled={busy} onClick={() => run("deliver", "Narudžba je označena kao isporučena.")}>
        Isporučeno
      </Button>,
    );
  }
  if (order.status === "DELIVERED" && can(MANAGERS)) {
    buttons.push(
      <Button
        key="complete"
        disabled={busy || !paid}
        title={!paid ? "Narudžba još nije plaćena." : undefined}
        onClick={() => run("complete", "Narudžba je završena.")}
      >
        Završi narudžbu
      </Button>,
    );
  }
  if (CANCELLABLE.includes(order.status) && can(MANAGERS)) {
    buttons.push(
      <Button key="cancel" variant="destructive" disabled={busy} onClick={() => setDialog("cancel")}>
        Otkaži
      </Button>,
    );
  }

  if (!buttons.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {buttons}
      <PaidDialog open={dialog === "paid"} busy={busy} onClose={() => setDialog(null)} onSubmit={() => run("mark-paid", "Uplata je evidentirana.")} />
      <CancelDialog
        open={dialog === "cancel"}
        busy={busy}
        paid={paid}
        onClose={() => setDialog(null)}
        onSubmit={(reason) => run("cancel", "Narudžba je otkazana.", { reason })}
      />
      <ShipDialog
        open={dialog === "ship"}
        busy={busy}
        pickup={pickup}
        onClose={() => setDialog(null)}
        onSubmit={(body) => run("ship", pickup ? "Narudžba je predata kupcu." : "Narudžba je otpremljena.", body)}
      />
    </div>
  );
}

interface DialogProps<T = void> {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (value: T) => void;
}

function Shell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Odustani</DialogClose>
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaidDialog({ open, busy, onClose, onSubmit }: DialogProps) {
  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Evidentirati uplatu?"
      description="Narudžba će biti označena kao plaćena. Ova radnja se ne može poništiti."
      footer={
        <Button disabled={busy} onClick={() => onSubmit()}>
          Evidentiraj uplatu
        </Button>
      }
    />
  );
}

function CancelDialog({ open, busy, paid, onClose, onSubmit }: DialogProps<string> & { paid: boolean }) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3;
  return (
    <Shell
      open={open}
      onClose={onClose}
      title="Otkazati narudžbu?"
      description={
        paid
          ? "Rezervacija robe se oslobađa, a račun stornira. Narudžba je plaćena: kupcu treba vratiti novac."
          : "Rezervacija robe se oslobađa, a račun stornira. Kupac se obavještava emailom, ako ga je naveo."
      }
      footer={
        <Button variant="destructive" disabled={busy || !valid} onClick={() => onSubmit(reason.trim())}>
          Otkaži narudžbu
        </Button>
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="cancel-reason">Razlog otkazivanja</Label>
        <Textarea id="cancel-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Shell>
  );
}

function ShipDialog({
  open,
  busy,
  pickup,
  onClose,
  onSubmit,
}: DialogProps<{ carrier?: string; trackingNumber?: string }> & { pickup: boolean }) {
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={pickup ? "Predati narudžbu kupcu?" : "Otpremiti narudžbu?"}
      description="Roba se skida sa stanja i izdaje se otpremnica (i garantni list za robu sa serijskim brojem). Kupac ih dobija emailom, ako ga je naveo."
      footer={
        <Button
          disabled={busy}
          onClick={() => onSubmit({ carrier: carrier.trim() || undefined, trackingNumber: tracking.trim() || undefined })}
        >
          {pickup ? "Predaj kupcu" : "Otpremi"}
        </Button>
      }
    >
      {!pickup && (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="ship-carrier">Kurirska služba</Label>
            <Input id="ship-carrier" value={carrier} maxLength={100} onChange={(e) => setCarrier(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ship-tracking">Broj pošiljke</Label>
            <Input id="ship-tracking" value={tracking} maxLength={100} onChange={(e) => setTracking(e.target.value)} />
          </div>
        </div>
      )}
    </Shell>
  );
}
