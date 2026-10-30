"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { signUpForSocial, withdrawFromSocial } from "@/app/actions/americano";
import { CancelActionButton } from "@/components/ui/ActionButton";

/** Sign-up box on an evening's public page. Visitors sign in first and come back. */
export default function SocialSignUp({
  eventId,
  signedIn,
  myName,
  defaultName,
  status,
  full,
  paused,
}: {
  eventId: string;
  signedIn: boolean;
  myName: string | null;
  defaultName: string;
  status: "open" | "running" | "finished";
  full: boolean;
  paused: boolean;
}) {
  const t = useTranslations("americano");
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (action: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await action();
      if (r.error) setError(t(`errors.${r.error}`));
      else router.refresh();
    });
  const box = "rounded-2xl border border-ink-100 bg-white p-5";

  if (myName) {
    return (
      <div className={box}>
        <p className="text-sm font-medium text-ink-900">{t("public.youreIn", { name: myName })}</p>
        {status !== "finished" && (
          <CancelActionButton
            disabled={pending}
            onClick={() => (status === "open" || confirm(t("public.withdrawConfirm"))) && run(() => withdrawFromSocial(eventId))}
            className="mt-3"
          >
            {t("public.withdraw")}
          </CancelActionButton>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
  if (status !== "open" || full || paused) {
    return (
      <div className={box}>
        <p className="text-sm text-ink-600">
          {paused ? t("errors.paused") : status === "open" ? t("public.full") : t("public.closedNote")}
        </p>
      </div>
    );
  }
  if (!signedIn) {
    return (
      <div className={box}>
        <p className="mb-3 text-sm font-semibold text-ink-900">{t("public.signUpTitle")}</p>
        <Link href={`/login?redirectTo=${encodeURIComponent(`/${locale}/americano/${eventId}`)}`} className="btn-primary inline-flex">
          {t("public.signInToSignUp")}
        </Link>
      </div>
    );
  }
  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => signUpForSocial(eventId, name));
      }}
    >
      <p className="mb-3 text-sm font-semibold text-ink-900">{t("public.signUpTitle")}</p>
      <label className="mb-1 block text-xs text-ink-400" htmlFor="social-name">
        {t("public.yourName")}
      </label>
      <input id="social-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      <p className="mt-1.5 text-xs text-ink-400">{t("public.aloneHint")}</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending || !name.trim()} className="btn-primary mt-4 w-full justify-center disabled:opacity-50">
        {t("public.signUp")}
      </button>
    </form>
  );
}
