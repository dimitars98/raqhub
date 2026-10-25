"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { joinMatch } from "@/app/actions/openMatches";
import { useLabels } from "@/hooks/useLabels";
import { fitsLevel, isFull, rangeText, type MatchCard as Match } from "@/lib/openMatches";
import { EmptyDot, PlayerDot, money, useWhen } from "./bits";

/**
 * One open match in a list: when, where, level, who's in, and a button.
 * `viewer` "visitor" (a club's public page) gets a sign-in link instead.
 */
export default function MatchCard({
  match: m,
  myLevel,
  viewer = "player",
  showClub = true,
  loginHref = "/login",
}: {
  match: Match;
  /** The player's level for this match's sport, or null when not set. */
  myLevel: number | null;
  viewer?: "player" | "visitor";
  showClub?: boolean;
  loginHref?: string;
}) {
  const t = useTranslations("matches");
  const labels = useLabels();
  const when = useWhen();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const full = isFull(m);
  const fits = fitsLevel(m, myLevel);
  const slots = Math.max(0, m.max_players - m.players.length);
  const href = `/matches/${m.id}`;

  const join = () =>
    startTransition(async () => {
      setError(null);
      // No level yet: set it first, then come back to this match.
      if (myLevel == null) {
        router.push(`/matches/level?sport=${m.sport}&next=${encodeURIComponent(href)}`);
        return;
      }
      const r = await joinMatch(m.id, null);
      if (r.error) {
        setError(t(`errors.${r.error}`));
        return;
      }
      router.push(href);
    });

  let action: React.ReactNode;
  if (m.mine === "in") {
    action = <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-900">{t("youreIn")}</span>;
  } else if (m.mine === "requested") {
    action = <span className="rounded-full bg-accent-100 px-3 py-1.5 text-xs font-semibold text-accent-800">{t("asked")}</span>;
  } else if (full) {
    action = <span className="text-xs text-ink-600">{t("full")}</span>;
  } else if (viewer === "visitor") {
    action = (
      <Link href={loginHref} className="btn-primary px-4 py-2 text-[13px]">
        {t("signInToJoin")}
      </Link>
    );
  } else {
    action = (
      <button
        type="button"
        onClick={join}
        disabled={pending}
        className={
          fits || myLevel == null
            ? "btn-primary px-4 py-2 text-[13px]"
            : "btn-secondary px-4 py-2 text-[13px]"
        }
      >
        {pending ? t("joining") : fits || myLevel == null ? t("join") : t("askToJoin")}
      </button>
    );
  }

  return (
    <article
      className={`flex flex-col gap-3 rounded-[18px] border bg-white p-4 ${
        m.mine ? "border-brand-200" : "border-ink-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <Link href={href} className="min-w-0 hover:underline">
          <span className="block text-base font-bold text-ink-900">{when(m.starts_at, m.ends_at)}</span>
          <span className="block text-xs text-ink-600">
            {[
              labels.sport(m.sport),
              showClub ? m.club.name : null,
              m.court,
              t("levelRange", { range: rangeText(m.level_min, m.level_max) }),
              m.competitive ? t("competitive") : t("friendly"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </Link>
        {Number(m.price_each) > 0 ? (
          <span className="shrink-0 text-sm font-semibold whitespace-nowrap text-ink-900">
            {money(m.price_each)}
            <span className="text-[11px] font-normal text-ink-600"> {t("each")}</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {m.players.map((p, i) => (
            <PlayerDot key={`${p.name}-${i}`} player={p} />
          ))}
          {Array.from({ length: slots }, (_, i) => (
            <EmptyDot key={`e${i}`} label={t("freePlace")} />
          ))}
          <span className="ml-1 text-xs text-ink-600">
            {full ? t("full") : t("placesLeft", { n: m.max_players - m.taken })}
          </span>
        </div>
        {action}
      </div>

      {viewer === "player" && !m.mine && !full && myLevel != null && !fits && (
        <p className="text-xs text-ink-600">{t("outsideRange", { level: myLevel.toFixed(1) })}</p>
      )}
      {m.members_only && !m.mine && <p className="text-xs text-ink-600">{t("membersOnlyNote")}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </article>
  );
}
