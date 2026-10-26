"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query, for the few things the browser loads itself: free times
 * on the booking screens, the member discount and notifications. Pages are
 * still loaded on the server; this doesn't change that.
 */
export default function QueryProvider({ children }: { children: ReactNode }) {
  // One client per browser tab (and per request on the server).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Shown at once when you come back to them, and refreshed in the
            // background after this long, or when you return to the tab.
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
