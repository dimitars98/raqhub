import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";

type Props = {
  title: string;
  body: string;
  /** Buttons or links: retry, go home… */
  actions: ReactNode;
  /** Shown small, so a reported problem can be found in the logs. */
  reference?: string | null;
  /** "page" fills the screen; "panel" sits inside the dashboard. */
  variant?: "page" | "panel";
};

// The one look for "something went wrong" and "page not found".
export default function ErrorState({ title, body, actions, reference, variant = "page" }: Props) {
  return (
    <div
      className={
        variant === "page"
          ? "flex min-h-[100dvh] items-center justify-center bg-ink-50 px-4 py-16"
          : "flex min-h-[60vh] items-center justify-center px-4 py-12"
      }
    >
      <div role="alert" className="w-full max-w-md text-center">
        <LogoMark className="mx-auto size-11" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-600">{body}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">{actions}</div>
        {reference && <p className="mt-8 font-mono text-xs text-ink-400">{reference}</p>}
      </div>
    </div>
  );
}
