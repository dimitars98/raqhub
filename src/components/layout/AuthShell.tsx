"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { LogoMark } from "@/components/ui/Logo";
import Image from "next/image";

type AuthShellProps = {
  /** Colour of the court panel: lime with dark lines, or dark with lime lines */
  tone?: "lime" | "ink";
  children: ReactNode;
};

export default function AuthShell({ tone = "lime", children }: AuthShellProps) {
  const locale = useLocale();

  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-2">
      {/* Content side */}
      <div className="flex min-h-dvh flex-col px-6 py-8 sm:px-10 lg:px-16">
        <Link
          href={`/${locale}`}
          className="inline-flex w-fit items-center gap-2 text-xl font-semibold tracking-tight text-brand-900"
        >
          {/* <LogoMark className="size-8" /> */}
          <Image src="/logo2_dark.png" alt="logo" width={40} height={40} />
          Kortello
        </Link>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>

      {/* Court side — decorative, desktop only */}
      <div
        aria-hidden="true"
        className="hidden p-4 lg:sticky lg:top-0 lg:block lg:h-dvh"
      >
        <div
          className={`relative h-full overflow-hidden rounded-[2rem] transition-colors duration-300 ${
            tone === "ink"
              ? "bg-ink-900 text-brand-400"
              : "bg-brand-400 text-ink-900"
          }`}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 600 800"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
          >
            {/* Top-down court, tilted and cropped by the panel edges */}
            <g transform="translate(300 400) rotate(-20) scale(1.25) translate(-180 -390)">
              {/* Playing surface */}
              <rect
                x="0"
                y="0"
                width="360"
                height="780"
                fill="currentColor"
                opacity="0.07"
              />
              <g stroke="currentColor" strokeWidth="4">
                {/* Doubles court outline */}
                <rect x="0" y="0" width="360" height="780" />
                {/* Singles sidelines */}
                <line x1="45" y1="0" x2="45" y2="780" />
                <line x1="315" y1="0" x2="315" y2="780" />
                {/* Service lines */}
                <line x1="45" y1="180" x2="315" y2="180" />
                <line x1="45" y1="600" x2="315" y2="600" />
                {/* Centre service line */}
                <line x1="180" y1="180" x2="180" y2="600" />
                {/* Centre marks */}
                <line x1="180" y1="0" x2="180" y2="14" />
                <line x1="180" y1="766" x2="180" y2="780" />
              </g>
              {/* Net */}
              <line
                x1="-24"
                y1="390"
                x2="384"
                y2="390"
                stroke="currentColor"
                strokeWidth="8"
              />
            </g>

            {/* Ball and its shadow */}
            <ellipse
              cx="420"
              cy="506"
              rx="24"
              ry="9"
              fill="currentColor"
              opacity="0.18"
            />
            <circle
              cx="408"
              cy="470"
              r="22"
              fill="white"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              d="M392 456c10 6 14 18 10 30"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
