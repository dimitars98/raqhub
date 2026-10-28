"use client";

import { useState, useTransition } from "react";
import { useBusySlotsForCourts, useRefreshBusy } from "@/hooks/useBookingData";
import SelectField from "@/components/ui/SelectField";
import { useLocale, useTranslations } from "next-intl";
import { addDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { ChevronLeft } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { createOpenMatch } from "@/app/actions/openMatches";
import { useLabels } from "@/hooks/useLabels";
import { GROUP_TIME_ZONE, clubDay, clubFormat, noon } from "@/lib/groups";
import { normalizeHours, startHoursFor } from "@/lib/openingHours";
import { normalizeRules } from "@/lib/bookingRules";
import {
  canPlaySingles,
  clampLevel,
  levelText,
  type MatchClub,
  type MyLevel,
} from "@/lib/openMatches";
import type { Sport } from "@/types/database";
import { Stepper, money } from "./bits";

export type NewMatchCourt = {
  id: string;
  name: string;
  sport: Sport;
  club_id: string;
  price_per_hour: number;
  is_indoor: boolean | null;
};

export type NewMatchClubInfo = { id: string; opening_hours: unknown; booking_rules: unknown };


/** How far ahead the day buttons go, at most. */
const MAX_DAYS_SHOWN = 14;

const pad = (n: number) => String(n).padStart(2, "0");

export default function NewMatchClient({
  clubs,
  courts,
  info,
  levels,
  initialClub,
  initialSport,
}: {
  clubs: MatchClub[];
  courts: NewMatchCourt[];
  info: NewMatchClubInfo[];
  levels: MyLevel[];
  initialClub: string | null;
  initialSport: Sport | null;
}) {
  const t = useTranslations("matches");
  const locale = useLocale();
  const labels = useLabels();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clubId, setClubId] = useState<string>(initialClub ?? clubs[0]?.id ?? "");
  const club = clubs.find((c) => c.id === clubId) ?? null;
  const sports = (club?.sports ?? []).filter((s) => courts.some((k) => k.club_id === clubId && k.sport === s));
  const [sportPick, setSport] = useState<Sport | null>(initialSport);
  const sport: Sport | null = sportPick && sports.includes(sportPick) ? sportPick : (sports[0] ?? null);

  const clubInfo = info.find((i) => i.id === clubId);
  const rules = normalizeRules(clubInfo?.booking_rules);
  const hours = normalizeHours(clubInfo?.opening_hours);
  const durations = rules.durations;
  const [durationPick, setDuration] = useState(90);
  const duration = durations.includes(durationPick) ? durationPick : durations.includes(90) ? 90 : durations[0];

  const today = clubDay(new Date());
  const days = Array.from({ length: Math.min(rules.max_days_ahead, MAX_DAYS_SHOWN) }, (_, i) =>
    clubDay(addDays(noon(today), i)),
  );
  const [dayPick, setDay] = useState(today);
  const day = days.includes(dayPick) ? dayPick : days[0];

  const sportCourts = courts.filter((k) => k.club_id === clubId && k.sport === sport);
  const myLevel = sport ? (levels.find((l) => l.sport === sport)?.level ?? null) : null;

  // Taken (and closed) times on each court that day.
  const { byCourt, ready } = useBusySlotsForCourts(
    sportCourts.map((k) => k.id),
    day,
  );
  const refreshBusy = useRefreshBusy();

  // Free start times: whole hours inside the opening hours, per court.
  const startOf = (h: number) => fromZonedTime(`${day}T${pad(h)}:00:00`, GROUP_TIME_ZONE);
  const now = new Date();
  const slots =
    !ready
      ? []
      : startHoursFor(hours, noon(day), duration).flatMap((h) => {
          const start = startOf(h);
          if (start <= now) return [];
          const end = new Date(start.getTime() + duration * 60_000);
          return sportCourts.map((k) => ({
            hour: h,
            court: k,
            taken: (byCourt[k.id] ?? []).some(
              (b) => start < new Date(b.ends_at) && end > new Date(b.starts_at),
            ),
          }));
        });

  const [pick, setPick] = useState<{ courtId: string; hour: number } | null>(null);
  const picked = pick && slots.find((s) => s.court.id === pick.courtId && s.hour === pick.hour && !s.taken);

  // Who can join: the organiser's level ± 0.5 to start with.
  const [range, setRange] = useState<{ min: number; max: number } | null>(null);
  const levelMin = range?.min ?? clampLevel((myLevel ?? 3) - 0.5);
  const levelMax = range?.max ?? clampLevel((myLevel ?? 3) + 0.5);
  const [competitive, setCompetitive] = useState(false);
  const [singlesPick, setSingles] = useState(false);
  const singles = !!sport && canPlaySingles(sport) && singlesPick;
  const players = singles ? 2 : 4;
  const [note, setNote] = useState("");

  const courtPrice = picked ? (picked.court.price_per_hour * duration) / 60 : 0;
  const each = Math.round((courtPrice / players) * 100) / 100;
  const blockedMember = !!club && club.members_only && !club.member;

  const submit = () => {
    if (!picked || !sport) return;
    startTransition(async () => {
      setError(null);
      const r = await createOpenMatch({
        court_id: picked.court.id,
        starts_at: startOf(picked.hour).toISOString(),
        duration_min: duration,
        level_min: levelMin,
        level_max: levelMax,
        competitive,
        max_players: players,
        note,
      });
      if (r.error) {
        setError(r.error === "booking" ? (r.message ?? t("errors.failed")) : t(`errors.${r.error}`));
        // Someone may have taken the slot meanwhile: load the times again.
        setPick(null);
        refreshBusy();
        return;
      }
      // The club takes payment online: pay for the court first (Stripe), then back to the match.
      if (r.checkoutUrl) {
        window.location.assign(r.checkoutUrl);
        return;
      }
      router.push(`/matches/${r.id}?new=1`);
    });
  };

  const box = "flex flex-col gap-3 rounded-[18px] border border-ink-100 bg-white p-4";
  const step = "text-xs font-semibold tracking-wider text-ink-600 uppercase";
  const toggle = (on: boolean) =>
    `h-11 rounded-[10px] text-[13px] transition-colors ${on ? "bg-white font-semibold text-ink-900 shadow-sm" : "text-ink-600"}`;

  if (clubs.length === 0) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col gap-4">
        <Back />
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
          <p className="text-base font-semibold text-ink-900">{t("noClubs")}</p>
          <p className="mt-1 text-sm text-ink-600">{t("noClubsHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-5 pb-32 lg:pb-6">
      <Back />
      <h1 className="font-display text-2xl font-bold text-ink-900">{t("start")}</h1>

      {/* Club and sport */}
      <section aria-labelledby="s-club" className="flex flex-col gap-2.5">
        <h2 id="s-club" className={step}>
          {t("step1")}
        </h2>
        {(clubs.length === 1 || sports.length === 1) && (
          <p className="rounded-[14px] border border-ink-100 bg-white px-4 py-3 text-sm text-ink-900">
            {[clubs.length === 1 ? club?.name : null, sports.length === 1 && sport ? labels.sport(sport) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {clubs.length > 1 && (
          <SelectField
            ariaLabel={t("club")}
            value={clubId}
            onChange={(v) => {
              setClubId(v);
              setPick(null);
            }}
            options={clubs.map((c) => ({ value: c.id, label: c.city ? `${c.name} · ${c.city}` : c.name }))}
          />
        )}
        {sports.length > 1 && (
          <div role="radiogroup" aria-label={t("sport")} className="grid grid-cols-3 gap-1 rounded-[14px] bg-ink-50 p-1">
            {sports.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={sport === s}
                onClick={() => {
                  setSport(s);
                  setPick(null);
                  setRange(null);
                }}
                className={toggle(sport === s)}
              >
                {labels.sport(s)}
              </button>
            ))}
          </div>
        )}
        {blockedMember && <p className="rounded-xl bg-accent-100 px-3 py-2.5 text-[13px] text-accent-800">{t("membersOnlyStart")}</p>}
      </section>

      {sport && myLevel == null ? (
        <div className="flex flex-col items-start gap-3 rounded-[18px] bg-ink-900 p-4 text-white">
          <span className="text-[15px] font-bold">{t("noLevelTitle", { sport: labels.sport(sport) })}</span>
          <span className="text-[13px] text-ink-200">{t("levelFirst")}</span>
          <Link
            href={`/matches/level?sport=${sport}&next=${encodeURIComponent(`/matches/new?sport=${sport}`)}`}
            className="rounded-full bg-brand-400 px-4 py-2.5 text-[13px] font-semibold text-ink-900"
          >
            {t("setLevel")}
          </Link>
        </div>
      ) : (
        sport &&
        !blockedMember && (
          <>
            {/* Day, length and time */}
            <section aria-labelledby="s-when" className="flex flex-col gap-2.5">
              <h2 id="s-when" className={step}>
                {t("step2")}
              </h2>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={d === day}
                    onClick={() => {
                      setDay(d);
                      setPick(null);
                    }}
                    className={`flex h-[52px] min-w-[60px] shrink-0 flex-col items-center justify-center rounded-xl border text-xs ${
                      d === day ? "border-ink-900 bg-ink-900 text-white" : "border-ink-100 bg-white text-ink-600"
                    }`}
                  >
                    <span className="font-semibold">
                      {d === today ? t("today") : clubFormat(noon(d), locale, { weekday: "short" })}
                    </span>
                    <span>{clubFormat(noon(d), locale, { day: "numeric", month: "short" })}</span>
                  </button>
                ))}
              </div>
              {durations.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {durations.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={d === duration}
                      onClick={() => {
                        setDuration(d);
                        setPick(null);
                      }}
                      className={`rounded-full border px-3.5 py-2 text-[13px] ${
                        d === duration ? "border-ink-900 bg-ink-900 font-semibold text-white" : "border-ink-100 bg-white text-ink-600"
                      }`}
                    >
                      {t("minutes", { n: d })}
                    </button>
                  ))}
                </div>
              )}
              <div className={box}>
                <span className="text-xs text-ink-600">{t("freeSlots", { n: duration })}</span>
                {!ready ? (
                  <p className="text-[13px] text-ink-600">{t("loadingSlots")}</p>
                ) : slots.length === 0 ? (
                  <p className="text-[13px] text-ink-600">{t("noSlots")}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {slots.map((s) => {
                      const on = pick?.courtId === s.court.id && pick.hour === s.hour;
                      return (
                        <button
                          key={`${s.court.id}-${s.hour}`}
                          type="button"
                          disabled={s.taken}
                          aria-pressed={on}
                          onClick={() => setPick({ courtId: s.court.id, hour: s.hour })}
                          className={`flex h-12 flex-col items-center justify-center rounded-[10px] border text-xs ${
                            s.taken
                              ? "cursor-not-allowed border-dashed border-ink-200 bg-ink-50 text-ink-400 line-through"
                              : on
                                ? "border-[1.5px] border-brand-900 bg-brand-50 font-bold text-brand-900"
                                : "border-ink-100 bg-white text-ink-600 hover:border-ink-200"
                          }`}
                        >
                          <span className="font-semibold">{pad(s.hour)}:00</span>
                          <span className="max-w-full truncate px-1 text-[11px]">{s.court.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Who can join */}
            <section aria-labelledby="s-level" className="flex flex-col gap-2.5">
              <h2 id="s-level" className={step}>
                {t("step3")}
              </h2>
              <div className={box}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink-900">
                    {t("levelRange", { range: `${levelText(levelMin)}–${levelText(levelMax)}` })}
                  </span>
                  <span className="text-xs text-ink-600">{t("yoursIs", { level: levelText(myLevel) })}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stepper
                    label={t("from")}
                    value={levelMin}
                    onChange={(v) => setRange({ min: v, max: Math.max(v, levelMax) })}
                  />
                  <Stepper
                    label={t("to")}
                    value={levelMax}
                    onChange={(v) => setRange({ min: Math.min(v, levelMin), max: v })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-ink-50 p-1">
                  <button type="button" aria-pressed={!competitive} onClick={() => setCompetitive(false)} className={toggle(!competitive)}>
                    {t("friendly")}
                  </button>
                  <button type="button" aria-pressed={competitive} onClick={() => setCompetitive(true)} className={toggle(competitive)}>
                    {t("competitive")}
                  </button>
                </div>
                {canPlaySingles(sport) && (
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-ink-50 p-1">
                    <button type="button" aria-pressed={!singles} onClick={() => setSingles(false)} className={toggle(!singles)}>
                      {t("doubles")}
                    </button>
                    <button type="button" aria-pressed={singles} onClick={() => setSingles(true)} className={toggle(singles)}>
                      {t("singles")}
                    </button>
                  </div>
                )}
                <span className="text-xs leading-relaxed text-ink-600">{t("outsideCanAsk")}</span>
              </div>
            </section>

            {/* Note */}
            <section aria-labelledby="s-note" className="flex flex-col gap-2.5">
              <h2 id="s-note" className={step}>
                {t("step4")}
              </h2>
              <label htmlFor="note" className="sr-only">
                {t("note")}
              </label>
              <textarea
                id="note"
                rows={2}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notePlaceholder")}
                className="input resize-none"
              />
            </section>

            {picked && (
              <section className={`${box} text-[13px]`}>
                <h2 className="text-[15px] font-bold text-ink-900">
                  {clubFormat(noon(day), locale, { weekday: "short", day: "numeric", month: "short" })} · {pad(picked.hour)}:00 ·{" "}
                  {picked.court.name}
                </h2>
                <div className="flex justify-between gap-3">
                  <span className="text-ink-600">{t("court")}</span>
                  <span className="text-right">
                    {money(courtPrice)} · <span className="font-semibold">{t("eachAtClub", { price: money(each) })}</span>
                  </span>
                </div>
                <p className="rounded-xl bg-accent-100 px-3 py-2.5 text-xs leading-relaxed text-accent-800">{t("bookedNow")}</p>
              </section>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white px-4 pt-3 pb-5 lg:static lg:border-0 lg:bg-transparent lg:p-0">
              <button
                type="button"
                onClick={submit}
                disabled={!picked || pending}
                className="btn-primary mx-auto flex h-12 w-full max-w-[560px] justify-center text-[15px] font-bold"
              >
                {pending ? t("opening") : picked ? t("bookAndOpen") : t("pickTime")}
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
}

function Back() {
  const t = useTranslations("matches");
  return (
    <Link href="/matches" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900">
      <ChevronLeft size={16} aria-hidden="true" />
      {t("back")}
    </Link>
  );
}
