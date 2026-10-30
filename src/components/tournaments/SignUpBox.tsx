"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { signUpForTournament, withdrawFromTournament } from "@/app/actions/tournaments";
import { CancelActionButton } from "@/components/ui/ActionButton";

/**
 * Sign-up box on a tournament's public page. Visitors are sent to sign in
 * first and come back here afterwards.
 */
export default function SignUpBox({
  tournamentId,
  signedIn,
  myEntryName,
  defaultName,
  open,
  full,
  pairs = false,
}: {
  tournamentId: string;
  signedIn: boolean;
  /** The name this player signed up under, if they did. */
  myEntryName: string | null;
  defaultName: string;
  open: boolean;
  full: boolean;
  /** A pairs tournament: ask for the partner too. */
  pairs?: boolean;
}) {
  const t = useTranslations("tournaments");
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
        {open && (
          <CancelActionButton
            disabled={pending}
            onClick={() => run(() => withdrawFromTournament(tournamentId))}
            className="mt-3"
          >
            {t("public.withdraw")}
          </CancelActionButton>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (!open || full) {
    return (
      <div className={box}>
        <p className="text-sm text-ink-600">{full && open ? t("public.full") : t("public.closedNote")}</p>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className={box}>
        <p className="mb-3 text-sm font-semibold text-ink-900">{t("public.signUpTitle")}</p>
        <Link
          href={`/login?redirectTo=${encodeURIComponent(`/${locale}/tournaments/${tournamentId}`)}`}
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
        run(() => signUpForTournament(tournamentId, name, pairs ? partner : ""));
      }}
    >
      <p className="mb-3 text-sm font-semibold text-ink-900">{t("public.signUpTitle")}</p>
      <label className="mb-1 block text-xs text-ink-400" htmlFor="entry-name">
        {t("public.nameOnDraw")}
      </label>
      <input id="entry-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      {pairs ? (
        <>
          <label className="mb-1 mt-3 block text-xs text-ink-400" htmlFor="entry-partner">
            {t("public.partnerName")}
          </label>
          <input id="entry-partner" className="input" value={partner} onChange={(e) => setPartner(e.target.value)} />
          <p className="mt-1.5 text-xs text-ink-400">{t("public.partnerHint")}</p>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-ink-400">{t("public.nameHint")}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
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
