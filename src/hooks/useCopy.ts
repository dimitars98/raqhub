"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Copies text to the clipboard and remembers which item was copied for two
 * seconds, so a button can show "Copied" next to the right thing.
 *
 *   const { copied, copy } = useCopy();
 *   <button onClick={() => copy("link", url)}>{copied === "link" ? "✓" : "Copy"}</button>
 */
export function useCopy(resetAfterMs = 2000) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // No state updates after the component is gone.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), resetAfterMs);
    } catch {
      // Clipboard blocked (old browser or not https): the text is still on screen.
    }
  };

  return { copied, copy };
}
