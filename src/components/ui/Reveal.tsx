"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Slides its content up into place the first time it scrolls into view.
 * Framer Motion's whileInView watches the scroll with an IntersectionObserver.
 * People who turned on "reduce motion" on their device just see it in place.
 */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Seconds to wait before sliding in, to stagger things side by side. */
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 64 }}
      whileInView={{ opacity: 1, y: 0 }}
      // Starts as soon as the top of the section is 10% above the bottom of
      // the screen, and only once: scrolling back up doesn't replay it.
      // "amount: 0" matters: a share of the section's height (e.g. 12%) can
      // be taller than a phone screen for long sections, and they'd never
      // appear.
      viewport={{ once: true, amount: 0, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
