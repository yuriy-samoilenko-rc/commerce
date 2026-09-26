"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { count, dayMonth, money } from "@/lib/format";

interface Point {
  day: string;
  revenue: number;
  orders: number;
}

export function SalesChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="day" tickFormatter={dayMonth} tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
          <YAxis tickFormatter={(v: number) => count(v)} tickLine={false} axisLine={false} fontSize={11} width={56} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            labelFormatter={(label) => dayMonth(String(label))}
            formatter={(value, _name, item) => [`${money(Number(value))} · ${count((item.payload as Point).orders)} narudžbi`, "Promet"]}
          />
          <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
