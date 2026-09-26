import Link from "next/link";
import type { User } from "@/lib/backend-types";
import { MobileNav } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

export function AdminShell({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-60 shrink-0 border-r bg-muted/30 md:flex md:flex-col">
        <Link href="/admin" className="flex h-14 items-center border-b px-5 text-lg font-semibold">
          TechStore
        </Link>
        <SidebarNav role={user.role} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <MobileNav role={user.role} />
          <Link href="/admin" className="font-semibold md:hidden">
            TechStore
          </Link>
          <div className="flex-1" />
          <NotificationBell />
          <UserMenu user={user} />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
