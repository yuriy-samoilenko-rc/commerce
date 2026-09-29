import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { Pager } from "@/components/admin/pager";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StaffReviewList } from "@/lib/backend-types";
import { dateTime } from "@/lib/format";
import { REVIEW_STATUS } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { ModerateButtons } from "./moderate-buttons";

export const metadata: Metadata = { title: "Ocjene kupaca" };

const LIMIT = 20;

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/ocjene">) {
  const user = await requireUser("/admin/ocjene");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/admin");
  const sp = await searchParams;
  // Without a choice the moderation queue is shown; "all" lists everything.
  const status = sp.status === "all" ? undefined : (pickParam(sp.status, REVIEW_STATUS) ?? "PENDING");
  const page = Math.max(1, Number(sp.page) || 1);
  const query = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (status) query.set("status", status);
  const { status: code, data } = await apiServer<StaffReviewList>(`/admin/reviews?${query}`);
  if (!data) throw new Error(`Reviews failed with status ${code}`);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Ocjene kupaca</h1>
      <p className="text-sm text-muted-foreground">
        Ocjene ostavljaju kupci koji su proizvod primili. U prodavnici se prikazuju tek kada ih odobrite.
      </p>
      <form className="flex flex-wrap items-end gap-2">
        <FilterSelect name="status" label="Status" value={status ?? "all"} options={{ ...REVIEW_STATUS, all: "Sve ocjene" }} />
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
      </form>
      <Card>
        <CardContent className="flex flex-col gap-3">
          {data.items.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nema ocjena za prikaz.</p>}
          {data.items.map((r) => (
            <article key={r.id} className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-amber-500" aria-label={`${r.rating} od 5`}>
                  {"★".repeat(r.rating)}
                  <span className="text-muted-foreground/40">{"★".repeat(5 - r.rating)}</span>
                </span>
                <Link href={`/admin/proizvodi/${r.product.id}`} className="font-medium underline-offset-4 hover:underline">
                  {r.product.name}
                </Link>
                <Badge variant={r.status === "APPROVED" ? "secondary" : r.status === "REJECTED" ? "destructive" : "outline"}>
                  {REVIEW_STATUS[r.status]}
                </Badge>
              </div>
              {r.title && <strong className="text-sm">{r.title}</strong>}
              <p className="text-sm whitespace-pre-line">{r.text}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {r.user.name} ({r.user.email}) · {dateTime(r.createdAt)}
                  {r.moderatedBy && ` · ${REVIEW_STATUS[r.status].toLowerCase()}: ${r.moderatedBy.name}, ${dateTime(r.moderatedAt)}`}
                </span>
                <ModerateButtons id={r.id} status={r.status} />
              </div>
            </article>
          ))}
          <Pager path="/admin/ocjene" params={{ status: sp.status === "all" ? "all" : status }} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
