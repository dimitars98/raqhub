"use client";

import ErrorView from "@/components/ui/ErrorView";

// Anything that fails while loading a page, in every language.
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} />;
}
