"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RotateCw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import ErrorState from "@/components/ui/ErrorState";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  /** "page" for public pages, "panel" inside the dashboard (keeps the sidebar). */
  variant?: "page" | "panel";
};

// What error.tsx files render. Shared so every part of the app says the same.
export default function ErrorView({ error, reset, variant = "page" }: Props) {
  const t = useTranslations("errorPage");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  // reset() alone only re-renders what's already in the browser. Refreshing
  // first fetches the page from the server again, which is what usually failed.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <ErrorState
      variant={variant}
      title={t("title")}
      body={t("body")}
      reference={error.digest ? t("reference", { code: error.digest }) : null}
      actions={
        <>
          <button
            type="button"
            onClick={retry}
            disabled={pending}
            className="btn-primary h-11 justify-center px-6 disabled:opacity-60"
          >
            <RotateCw size={16} aria-hidden="true" className={pending ? "animate-spin" : ""} />
            {t("retry")}
          </button>
          <Link
            href={variant === "panel" ? "/dashboard" : "/"}
            className="btn-secondary inline-flex h-11 items-center justify-center px-6"
          >
            {variant === "panel" ? t("backToApp") : t("home")}
          </Link>
        </>
      }
    />
  );
}
