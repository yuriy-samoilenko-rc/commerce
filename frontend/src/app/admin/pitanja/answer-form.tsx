"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";

/** Answer (publishes and emails the customer) or hide the question. */
export function AnswerForm({ id, status, answer }: { id: string; status: string; answer: string | null }) {
  const router = useRouter();
  const [text, setText] = useState(answer ?? "");
  const [busy, setBusy] = useState(false);
  const run = async (path: string, json: unknown, done: string) => {
    setBusy(true);
    try {
      await api(`/admin/questions/${id}/${path}`, { method: "POST", json });
      toast.success(done);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label="Odgovor"
        rows={3}
        maxLength={3000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Odgovor koji će vidjeti svi kupci"
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || text.trim().length < 2} onClick={() => run("answer", { answer: text }, "Odgovor je objavljen i poslat kupcu.")}>
          {status === "PUBLISHED" ? "Sačuvaj odgovor" : "Objavi odgovor"}
        </Button>
        {status !== "HIDDEN" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run("hide", {}, "Pitanje je sakriveno.")}>
            Sakrij
          </Button>
        )}
      </div>
    </div>
  );
}
