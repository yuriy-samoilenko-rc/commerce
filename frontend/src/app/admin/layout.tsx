import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { STAFF_ROLES } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser("/admin");
  // Customers have no business in the back office.
  if (!STAFF_ROLES.includes(user.role)) redirect("/");
  return <AdminShell user={user}>{children}</AdminShell>;
}
