import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { UserList } from "@/lib/backend-types";
import { dateTime } from "@/lib/format";
import { ROLE } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { EmployeeDialog } from "./employee-dialog";

export const metadata: Metadata = { title: "Zaposleni" };

/** What each role may do, so the admin picks the right one. */
const ROLE_SCOPE = [
  ["ADMIN", "sve, uključujući zaposlene i podešavanja"],
  ["MANAGER", "narudžbe, proizvodi, cijene, povraćaji, izvještaji, promo kodovi"],
  ["WAREHOUSE", "prijem, prenos, popis, priprema narudžbi, izvještaji o zalihama"],
  ["ACCOUNTANT", "dokumenti, plaćanja i finansijski izvještaji"],
] as const;

export default async function EmployeesPage() {
  const me = await requireUser("/admin/zaposleni");
  if (me.role !== "ADMIN") redirect("/admin");
  const { status, data } = await apiServer<UserList>("/users");
  if (!data) throw new Error(`Employees failed with status ${status}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Zaposleni</h1>
        <EmployeeDialog />
      </div>
      <Card>
        <CardContent>
          <DataTable
            head={["Ime i prezime", "E-pošta", "Uloga", "Posljednja prijava", "Status", ""]}
            minWidth="48rem"
            empty="Još nema zaposlenih."
            rows={data.map((u) => [
              <span key="n" className="font-medium">
                {u.name}
                {u.id === me.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(vi)</span>}
              </span>,
              u.email,
              ROLE[u.role],
              u.lastLoginAt ? dateTime(u.lastLoginAt) : "nikad",
              u.isActive ? <Badge key="s">Aktivan</Badge> : <Badge key="s" variant="outline">Deaktiviran</Badge>,
              <EmployeeDialog key="e" employee={u} self={u.id === me.id} />,
            ])}
          />
        </CardContent>
      </Card>
      <section aria-labelledby="uloge" className="flex flex-col gap-2 text-sm">
        <h2 id="uloge" className="font-medium">
          Uloge
        </h2>
        <dl className="grid gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-[max-content_1fr]">
          {ROLE_SCOPE.map(([role, scope]) => (
            <div key={role} className="contents">
              <dt className="font-medium text-foreground">{ROLE[role]}</dt>
              <dd>{scope}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground">
          Deaktiviran zaposleni se više ne može prijaviti, a otvorene sesije mu se odmah prekidaju. Istorija njegovog rada ostaje
          sačuvana.
        </p>
      </section>
    </div>
  );
}
