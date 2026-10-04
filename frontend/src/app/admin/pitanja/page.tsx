import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { Pager } from "@/components/admin/pager";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StaffQuestionList } from "@/lib/backend-types";
import { dateTime } from "@/lib/format";
import { QUESTION_STATUS } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { AnswerForm } from "./answer-form";

export const metadata: Metadata = { title: "Pitanja kupaca" };

const LIMIT = 20;

export default async function QuestionsPage({ searchParams }: PageProps<"/admin/pitanja">) {
  const user = await requireUser("/admin/pitanja");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/admin");
  const sp = await searchParams;
  // Without a choice the unanswered queue is shown; "all" lists everything.
  const status = sp.status === "all" ? undefined : (pickParam(sp.status, QUESTION_STATUS) ?? "PENDING");
  const page = Math.max(1, Number(sp.page) || 1);
  const query = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (status) query.set("status", status);
  const { status: code, data } = await apiServer<StaffQuestionList>(`/admin/questions?${query}`);
  if (!data) throw new Error(`Questions failed with status ${code}`);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Pitanja kupaca</h1>
      <p className="text-sm text-muted-foreground">
        Pitanje se na stranici proizvoda prikazuje tek sa odgovorom; kupac odgovor dobija i emailom.
      </p>
      <form className="flex flex-wrap items-end gap-2">
        <FilterSelect name="status" label="Status" value={status ?? "all"} options={{ ...QUESTION_STATUS, all: "Sva pitanja" }} />
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
      </form>
      <Card>
        <CardContent className="flex flex-col gap-3">
          {data.items.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nema pitanja za prikaz.</p>}
          {data.items.map((q) => (
            <article key={q.id} className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={`/admin/proizvodi/${q.product.id}`} className="font-medium underline-offset-4 hover:underline">
                  {q.product.name}
                </Link>
                <Badge variant={q.status === "PUBLISHED" ? "secondary" : q.status === "HIDDEN" ? "outline" : "default"}>
                  {QUESTION_STATUS[q.status]}
                </Badge>
              </div>
              <p className="text-sm whitespace-pre-line">{q.question}</p>
              <span className="text-xs text-muted-foreground">
                {q.user.name} ({q.user.email}) · {dateTime(q.createdAt)}
                {q.answeredBy && q.answeredAt && ` · odgovorio/la ${q.answeredBy.name}, ${dateTime(q.answeredAt)}`}
              </span>
              <AnswerForm id={q.id} status={q.status} answer={q.answer} />
            </article>
          ))}
          <Pager path="/admin/pitanja" params={{ status: sp.status === "all" ? "all" : status }} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
