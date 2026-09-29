import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanySettings, WarehouseList } from "@/lib/backend-types";
import { apiServer, requireUser } from "@/lib/session";
import { CompanyForm, WarehouseDialog } from "./settings-forms";

export const metadata: Metadata = { title: "Podešavanja" };

export default async function SettingsPage() {
  const user = await requireUser("/admin/podesavanja");
  if (user.role !== "ADMIN") redirect("/admin");
  const [company, warehouses] = await Promise.all([
    apiServer<CompanySettings>("/admin/settings/company"),
    apiServer<WarehouseList>("/warehouses"),
  ]);
  if (!company.data) throw new Error(`Settings failed with status ${company.status}`);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Podešavanja</h1>
      <CompanyForm settings={company.data} />
      <Card>
        <CardHeader>
          <CardTitle>Skladišta i prodavnice</CardTitle>
          <CardDescription>
            Skladišta označena kao „mjesto preuzimanja“ internet prodavnica nudi za lično preuzimanje, sa adresom, telefonom i
            radnim vremenom.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            head={["Naziv", "Adresa", "Telefon", "Radno vrijeme", "Status", ""]}
            minWidth="52rem"
            empty="Još nema skladišta."
            rows={(warehouses.data ?? []).map((w) => [
              <span key="n" className="font-medium">{w.name}</span>,
              w.address ?? "—",
              w.phone ?? "—",
              w.openingHours ?? "—",
              <div key="s" className="flex flex-wrap gap-1">
                {!w.isActive && <Badge variant="outline">Neaktivno</Badge>}
                {w.isPickupPoint && <Badge variant="secondary">Mjesto preuzimanja</Badge>}
              </div>,
              <WarehouseDialog key="e" warehouse={w} />,
            ])}
          />
          <div>
            <WarehouseDialog />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
