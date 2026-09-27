import { Badge } from "@/components/ui/badge";
import { dateTime } from "@/lib/format";
import { DOCUMENT_TYPE } from "@/lib/labels";

/** Issued documents as PDF links (they open through the API proxy in a new tab). */
export function DocumentLinks({
  documents,
  empty,
}: {
  documents: { id: string; type: string; number: string; status: string; issuedAt: string }[];
  empty: string;
}) {
  if (!documents.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {documents.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
          <a
            href={`/api/backend/admin/documents/${d.id}/pdf`}
            target="_blank"
            rel="noopener"
            className="underline-offset-4 hover:underline"
          >
            {DOCUMENT_TYPE[d.type]} {d.number}
          </a>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {d.status === "CANCELLED" && <Badge variant="destructive">STORNIRANO</Badge>}
            {dateTime(d.issuedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
