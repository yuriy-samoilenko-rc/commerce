import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { STAFF_ROLES } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: { template: "%s · Skladište", default: "Skladište" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Skladište" },
};

export const viewport: Viewport = { themeColor: "#171717" };

/** The warehouse phone app (ТЗ UI 34): no sidebar, big targets, one task per screen. */
export default async function MobileLayout({ children }: LayoutProps<"/m">) {
  const user = await requireUser("/m");
  if (!STAFF_ROLES.includes(user.role)) redirect("/");
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
        <Link href="/m" className="font-semibold">
          TechStore · Skladište
        </Link>
        <Link href="/admin" className="text-sm text-muted-foreground">
          Admin
        </Link>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
    </div>
  );
}
