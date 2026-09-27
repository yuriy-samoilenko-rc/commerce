"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser tab (created lazily, not shared between server requests).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      {/* Centered: in a corner it covers the page's action buttons (and stays while hovered). */}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
