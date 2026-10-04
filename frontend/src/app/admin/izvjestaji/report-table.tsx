import type { Report } from "@/lib/backend-types";
import { count, money } from "@/lib/format";
import { cn } from "@/lib/utils";

type Column = Report["columns"][number];
type Cell = Report["rows"][number][string];

/** A value as the column type says: 1.357,90 € / 23,5% / 1.204 / text. */
function show(v: Cell | undefined, type: Column["type"]) {
  if (v === null || v === undefined || v === "") return "—";
  if (type === "money") return money(v);
  if (type === "percent") return `${Number(v).toLocaleString("sr-Latn-ME", { maximumFractionDigits: 1 })}%`;
  if (type === "int") return count(Number(v));
  return String(v);
}

/** Any report from the API: typed columns, rows and a totals row; numbers right-aligned. */
export function ReportTable({ report }: { report: Report }) {
  const numeric = (c: Column) => c.type !== "text";
  if (!report.rows.length) return <p className="py-6 text-sm text-muted-foreground">Za izabrani period nema podataka.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {report.columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-2 py-2 font-medium whitespace-nowrap", numeric(c) && "text-right")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {report.columns.map((c) => (
                <td key={c.key} className={cn("px-2 py-2", numeric(c) && "text-right tabular-nums whitespace-nowrap")}>
                  {show(r[c.key], c.type)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {report.totals && (
          <tfoot>
            <tr className="border-t-2 font-semibold">
              {report.columns.map((c, i) => (
                <td key={c.key} className={cn("px-2 py-2", numeric(c) && "text-right tabular-nums whitespace-nowrap")}>
                  {i === 0 ? "Ukupno" : show(report.totals![c.key], c.type)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
