import { useEffect, useRef, type RefObject } from "react";

/**
 * Calls `handler` when a pointer press lands outside the element in `ref`.
 * Pass `enabled = false` to skip attaching the listener (e.g. while closed).
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: (event: PointerEvent) => void,
  enabled = true,
) {
  // Keep the latest handler without re-attaching the listener on every render
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (event: PointerEvent) => {
      const el = ref.current;
      if (el && !el.contains(event.target as Node)) {
        handlerRef.current(event);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [ref, enabled]);
}
