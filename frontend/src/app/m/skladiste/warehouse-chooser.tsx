import { Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chooseWarehouse } from "./actions";

export function WarehouseChooser({ warehouses }: { warehouses: { id: string; name: string }[] }) {
  if (!warehouses.length) return <p className="text-muted-foreground">Nema aktivnih skladišta.</p>;
  return (
    <form action={chooseWarehouse} className="flex flex-col gap-2">
      {warehouses.map((w) => (
        <Button
          key={w.id}
          type="submit"
          name="warehouseId"
          value={w.id}
          variant="outline"
          size="lg"
          className="h-14 justify-start text-base"
        >
          <Warehouse /> {w.name}
        </Button>
      ))}
    </form>
  );
}
