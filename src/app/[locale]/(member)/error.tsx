"use client";

import ErrorView from "@/components/ui/ErrorView";

// Inside the player area: the sidebar stays, only the page shows the error.
export default function MemberError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} variant="panel" />;
}
