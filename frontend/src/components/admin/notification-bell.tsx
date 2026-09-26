"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import type { NotificationList, UnreadCount } from "@/lib/backend-types";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // The badge polls; the list is loaded only while the menu is open.
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api<UnreadCount>("/notifications/unread-count"),
    refetchInterval: 30_000,
  });
  const list = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => api<NotificationList>("/notifications?limit=10"),
    enabled: open,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: refresh,
  });
  const markAll = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: refresh,
  });

  const count = unread.data?.unread ?? 0;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label={`Obavještenja: ${count} nepročitanih`} />}
      >
        <Bell />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Obavještenja</span>
            {count > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => markAll.mutate()}
              >
                Označi sve kao pročitano
              </button>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {list.isLoading && <p className="px-2 py-3 text-sm text-muted-foreground">Učitavanje…</p>}
        {list.data?.items.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">Nema obavještenja.</p>
        )}
        {list.data?.items.map((n) => (
          <DropdownMenuItem
            key={n.id}
            onClick={() => !n.readAt && markRead.mutate(n.id)}
            className={cn("flex flex-col items-start gap-0.5 py-2", !n.readAt && "bg-muted/60")}
          >
            <span className={cn("text-sm", !n.readAt && "font-medium")}>{n.title}</span>
            {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
            <span className="text-[11px] text-muted-foreground">{dateTime(n.createdAt)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
