"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { signUpForLeague, withdrawFromLeague } from "@/app/actions/leagues";
import { CancelActionButton } from "@/components/ui/ActionButton";

/** Sign-up box on a league's public page. Visitors sign in first and come back. */
export default function LeagueSignUp({
  leagueId,
  pairs,
  signedIn,
  myEntryName,
  defaultName,
  status,
  full,
  paused,
}: {
  leagueId: string;
  pairs: boolean;
  signedIn: boolean;
  myEntryName: string | null;
  defaultName: string;
  status: "open" | "running" | "finished";
  full: boolean;
  paused: boolean;
}) {
  const t = useTranslations("leagues");
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [partner, setPartner] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(t(`errors.${result.error}`));
      else router.refresh();
    });
  };

  const box = "rounded-2xl border border-ink-100 bg-white p-5";

  if (myEntryName) {
    return (
      <div className={box}>
        <p className="text-sm font-medium text-ink-900">{t("public.youreIn", { name: myEntryName })}</p>
        {status !== "finished" && (
          <CancelActionButton
            disabled={pending}
            onClick={() => (status === "open" || confirm(t("public.withdrawConfirm"))) && run(() => withdrawFromLeague(leagueId))}
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
        <Link
          href={`/login?redirectTo=${encodeURIComponent(`/${locale}/leagues/${leagueId}`)}`}
          className="btn-primary inline-flex"
        >
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
        run(() => signUpForLeague(leagueId, name, partner));
      }}
    >
      <p className="mb-3 text-sm font-semibold text-ink-900">{t("public.signUpTitle")}</p>
      <label className="mb-1 block text-xs text-ink-400" htmlFor="league-name">
        {t("public.yourName")}
      </label>
      <input id="league-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      {pairs && (
        <>
          <label className="mb-1 mt-3 block text-xs text-ink-400" htmlFor="league-partner">
            {t("public.partnerName")}
          </label>
          <input id="league-partner" className="input" value={partner} onChange={(e) => setPartner(e.target.value)} />
          <p className="mt-1.5 text-xs text-ink-400">{t("public.partnerHint")}</p>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || !name.trim() || (pairs && !partner.trim())}
        className="btn-primary mt-4 w-full justify-center disabled:opacity-50"
      >
        {t("public.signUp")}
      </button>
    </form>
  );
}
