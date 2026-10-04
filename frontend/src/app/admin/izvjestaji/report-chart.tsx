"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { count, money } from "@/lib/format";

interface Point {
  label: string;
  revenue: number;
  orders: number;
}

/** Revenue per period: one series, so no legend; the table below is the exact view. */
export function ReportChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Promet po periodima; tačni iznosi su u tabeli ispod">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
          <YAxis tickFormatter={(v: number) => count(v)} tickLine={false} axisLine={false} fontSize={11} width={64} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(value, _name, item) => [
              `${money(Number(value))} · ${count((item.payload as Point).orders)} narudžbi`,
              "Promet sa PDV",
            ]}
          />
          <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
