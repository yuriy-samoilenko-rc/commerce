import { cn } from "@/lib/utils";

/** A plain table that scrolls sideways inside its own box on narrow screens. */
export function DataTable({
  head,
  rows,
  empty,
  align,
  minWidth,
}: {
  head: string[];
  rows: React.ReactNode[][];
  empty: string;
  /** Column indexes to right-align (amounts, quantities). */
  align?: number[];
  /** Below this width the table scrolls instead of squeezing its columns. */
  minWidth?: string;
}) {
  if (!rows.length) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  const right = (i: number) => align?.includes(i) && "text-right tabular-nums";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={cn("px-2 py-2 font-medium whitespace-nowrap", right(i))}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b last:border-0">
              {cells.map((cell, j) => (
                <td key={j} className={cn("px-2 py-2 align-top", right(j))}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
