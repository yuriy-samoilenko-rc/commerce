"use client";

import { ClipboardCheck, LayoutDashboard, RotateCcw, ShieldCheck, Smartphone, Package, PackagePlus, ShoppingCart, Truck, Warehouse, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/backend-types";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omitted = every staff role. */
  roles?: Role[];
}

// Sections are added here as their screens are built (ТЗ UI, п.0).
const NAV: NavItem[] = [
  { href: "/admin", label: "Kontrolna tabla", icon: LayoutDashboard },
  { href: "/admin/narudzbe", label: "Narudžbe", icon: ShoppingCart },
  { href: "/admin/povracaji", label: "Povraćaji", icon: RotateCcw },
  { href: "/admin/garancija", label: "Garancija", icon: ShieldCheck },
  { href: "/admin/proizvodi", label: "Proizvodi", icon: Package },
  { href: "/admin/skladiste", label: "Skladište", icon: Warehouse },
  { href: "/admin/prijem", label: "Prijem robe", icon: PackagePlus },
  { href: "/admin/prenos", label: "Prenos robe", icon: Truck },
  { href: "/admin/popis", label: "Popis", icon: ClipboardCheck },
  // The phone app for scanning; admins, managers and storekeepers work in the warehouse.
  { href: "/m", label: "Mobilno skladište", icon: Smartphone, roles: ["ADMIN", "MANAGER", "WAREHOUSE"] },
];

export function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Glavni meni" className="flex flex-col gap-0.5 p-2">
      {NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              active && "bg-muted font-medium text-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
