"use client";

import { useState, useTransition } from "react";
import SelectField from "@/components/ui/SelectField";
import { useTranslations } from "next-intl";
import { ChevronLeft, Clock, ShieldCheck } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { requestLevelCheck, setLevel } from "@/app/actions/openMatches";
import { useLabels } from "@/hooks/useLabels";
import { LEVEL_BANDS, MATCH_SPORTS, bandOf, levelText, type MatchClub, type MyLevel } from "@/lib/openMatches";
import type { Sport } from "@/types/database";
import { Stepper } from "./bits";

export default function LevelClient({
  levels,
  clubs,
  initialSport,
  next,
}: {
  levels: MyLevel[];
  clubs: MatchClub[];
  initialSport: Sport;
  /** Where to go after saving (e.g. back to the match they wanted to join). */
  next: string | null;
}) {
  const t = useTranslations("matches");
  const labels = useLabels();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [sport, setSport] = useState<Sport>(initialSport);
  const current = levels.find((l) => l.sport === sport) ?? null;
  const [picks, setPicks] = useState<Partial<Record<Sport, number>>>({});
  const value = picks[sport] ?? current?.level ?? 3;
  const set = (v: number) => {
    setSaved(false);
    setPicks((p) => ({ ...p, [sport]: v }));
  };
  const band = bandOf(value);
  const clubsForSport = clubs.filter((c) => c.sports.includes(sport));
  const [checkClub, setCheckClub] = useState("");

  const save = () =>
    startTransition(async () => {
      setError(null);
      const r = await setLevel(sport, value);
      if (r.error) {
        setError(t(`errors.${r.error}`));
        return;
      }
      if (next) {
        router.push(next);
        return;
      }
      setSaved(true);
      router.refresh();
    });

  const askClub = () =>
    startTransition(async () => {
      setError(null);
      const clubId = checkClub || clubsForSport[0]?.id;
      if (!clubId) return;
      const r = await requestLevelCheck(sport, clubId);
      if (r.error) {
        setError(t(`errors.${r.error}`));
        return;
      }
      router.refresh();
    });

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-5 pb-32 lg:pb-6">
      <Link href="/matches" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900">
        <ChevronLeft size={16} aria-hidden="true" />
        {t("back")}
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">{t("levelTitle")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">{t("levelIntro")}</p>
      </div>

      <div role="tablist" aria-label={t("sport")} className="grid grid-cols-3 gap-1 rounded-[14px] border border-ink-100 bg-white p-1">
        {MATCH_SPORTS.map((s) => {
          const l = levels.find((x) => x.sport === s);
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sport === s}
              onClick={() => {
                setSport(s);
                setSaved(false);
              }}
              className={`flex h-12 flex-col items-center justify-center rounded-[10px] text-[13px] ${
                sport === s ? "bg-ink-900 font-semibold text-white" : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              {labels.sport(s)}
              <span className="text-[11px] opacity-75">{l ? levelText(l.level) : t("notSet")}</span>
            </button>
          );
        })}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t("levelTitle")}</legend>
        {LEVEL_BANDS.map((b) => {
          const on = band === b.key;
          return (
            <label
              key={b.key}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 ${
                on ? "border-[1.5px] border-brand-900 bg-brand-50" : "border-ink-100 bg-white hover:border-ink-200"
              }`}
            >
              <input
                type="radio"
                name="band"
                checked={on}
                onChange={() => set(b.from)}
                className="mt-1 size-[18px] accent-ink-900"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink-900">
                  {b.from === 5 ? t("bandFromUp", { from: levelText(b.from) }) : `${levelText(b.from)} – ${levelText(b.to)}`} ·{" "}
                  {t(`bands.${b.key}.name`)}
                </span>
                <span className="text-xs leading-relaxed text-ink-600">{t(`bands.${b.key}.desc`)}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="rounded-2xl border border-ink-100 bg-white p-3.5">
        <Stepper label={t("fineTune")} value={value} onChange={set} />
      </div>

      {/* A club can confirm it */}
      {current && (
        <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-ink-200 bg-white p-4">
          {current.confirmed_club && current.level === value ? (
            <p className="flex items-center gap-2 text-[13px] text-ink-900">
              <ShieldCheck size={16} className="text-brand-800" aria-hidden="true" />
              {t("checkedBy", { club: current.confirmed_club })}
            </p>
          ) : current.check_club_name ? (
            <p className="flex items-center gap-2 text-[13px] text-ink-900">
              <Clock size={16} className="text-ink-600" aria-hidden="true" />
              {t("checkPending", { club: current.check_club_name })}
            </p>
          ) : clubsForSport.length > 0 ? (
            <>
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-600">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-800" aria-hidden="true" />
                {t("checkHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                {clubsForSport.length > 1 && (
                  <div className="min-w-[180px] flex-1">
                    <SelectField
                      ariaLabel={t("club")}
                      value={checkClub || clubsForSport[0].id}
                      onChange={setCheckClub}
                      options={clubsForSport.map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                )}
                <button type="button" disabled={pending} onClick={askClub} className="btn-secondary">
                  {clubsForSport.length > 1 ? t("askCheck") : t("askCheckAt", { club: clubsForSport[0].name })}
                </button>
              </div>
            </>
          ) : null}
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && <p className="text-sm font-semibold text-brand-900">{t("levelSaved")}</p>}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white px-4 pt-3 pb-5 lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="btn-primary mx-auto flex h-12 w-full max-w-[560px] justify-center text-[15px] font-bold"
        >
          {t("saveLevel", { level: levelText(value), sport: labels.sport(sport) })}
        </button>
      </div>
    </div>
  );
}
