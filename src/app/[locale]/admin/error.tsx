"use client";

import ErrorView from "@/components/ui/ErrorView";

// Inside the admin area: the sidebar stays, only the page shows the error.
export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} variant="panel" />;
}
