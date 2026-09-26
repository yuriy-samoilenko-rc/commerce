"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-xl font-semibold">Podaci trenutno nijesu dostupni</h1>
      <p className="text-sm text-muted-foreground">Došlo je do greške pri učitavanju. Pokušajte ponovo za trenutak.</p>
      <Button onClick={() => retry()}>Pokušaj ponovo</Button>
    </div>
  );
}
