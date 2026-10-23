"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock, Plus, UsersRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useLabels } from "@/hooks/useLabels";
import { initials } from "@/lib/avatar";
import { ISO_DAYS, clubFormat, clubDay, money, monthName, scheduleText, weekdayName } from "@/lib/groups";
import type { Group } from "@/types/database";
import { useReadOnly } from "@/components/admin/ReadOnly";

export type GroupCard = Pick<
  Group,
  | "id"
  | "name"
  | "kind"
  | "sport"
  | "level"
  | "age_min"
  | "age_max"
  | "adults"
  | "days"
  | "start_time"
  | "end_time"
  | "max_players"
  | "price"
  | "archived_at"
  | "coach_id"
> & {
  coachName: string | null;
  courtName: string | null;
  /** Season: active + trial + offered. Drop-in: booked for the next session. */
  taken: number;
  waiting: number;
  requests: number;
  unpaid: number;
  next: string | null;
  sessionsThisWeek: number;
};

type Tab = "all" | "season" | "dropin" | "places" | "archived";

export default function GroupsClient({
  groups,
  clubName,
  month,
}: {
  groups: GroupCard[];
  clubName: string;
  month: string;
}) {
  const t = useTranslations("groups");
  const { readOnly, hint } = useReadOnly();
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("all");
  const [coach, setCoach] = useState("");
  const [day, setDay] = useState(0);

  const live = groups.filter((g) => !g.archived_at);
  const coaches = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) if (g.coach_id && g.coachName) map.set(g.coach_id, g.coachName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [groups]);

  const counts: Record<Tab, number> = {
    all: live.length,
    season: live.filter((g) => g.kind === "season").length,
    dropin: live.filter((g) => g.kind === "dropin").length,
    places: live.filter((g) => g.taken < g.max_players).length,
    archived: groups.length - live.length,
  };

  const shown = groups.filter((g) => {
    if (tab === "archived" ? !g.archived_at : g.archived_at) return false;
    if (tab === "season" && g.kind !== "season") return false;
    if (tab === "dropin" && g.kind !== "dropin") return false;
    if (tab === "places" && g.taken >= g.max_players) return false;
    if (coach && g.coach_id !== coach) return false;
    if (day && !g.days.includes(day)) return false;
    return true;
  });

  const season = live.filter((g) => g.kind === "season");
  const stats = {
    sessions: live.reduce((n, g) => n + g.sessionsThisWeek, 0),
    players: season.reduce((n, g) => n + g.taken, 0),
    full: season.filter((g) => g.taken >= g.max_players).length,
    waiting: season.reduce((n, g) => n + g.waiting, 0),
    waitingGroups: season.filter((g) => g.waiting > 0).length,
    unpaid: season.reduce((n, g) => n + g.unpaid, 0),
  };

  const monthLabel = monthName(month, locale, false);

  return (
    <div className="mx-auto max-w-[1140px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-ink-900">
            {t("title")} <span className="font-semibold text-ink-400">{counts.all}</span>
          </h1>
          <p className="mt-1 text-sm text-ink-600">{clubName}</p>
        </div>
        {readOnly ? (
          <button type="button" disabled title={hint} className="btn-primary">
            <Plus size={16} aria-hidden="true" />
            {t("new")}
          </button>
        ) : (
          <Link href="/admin/groups/new" className="btn-primary">
            <Plus size={16} aria-hidden="true" />
            {t("new")}
          </Link>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-800">
            <UsersRound size={22} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-ink-900">{t("empty")}</h2>
          <p className="mt-1 max-w-md text-sm text-ink-600">{t("emptyHint")}</p>
          {!readOnly && (
            <Link href="/admin/groups/new" className="btn-primary mt-6">
              {t("new")}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t("stats.sessions")} value={stats.sessions} />
            <Stat
              label={t("stats.players")}
              value={stats.players}
              sub={stats.full ? t("stats.full", { n: stats.full }) : undefined}
            />
            <Stat
              label={t("stats.waiting")}
              value={stats.waiting}
              sub={stats.waiting ? t("stats.inGroups", { n: stats.waitingGroups }) : undefined}
            />
            <Stat
              label={t("stats.unpaid", { month: monthLabel })}
              value={stats.unpaid}
              warn={stats.unpaid > 0}
            />
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label={t("title")} className="flex flex-wrap gap-2">
              {(["all", "season", "dropin", "places", "archived"] as Tab[])
                .filter((k) => k !== "archived" || counts.archived > 0)
                .map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={`rounded-full border px-3.5 py-2 text-[13px] transition-colors ${
                      tab === k
                        ? "border-ink-900 bg-ink-900 font-semibold text-white"
                        : "border-ink-100 bg-white text-ink-600 hover:border-ink-200"
                    }`}
                  >
                    {t(`tabs.${k}`)}{" "}
                    <span className={tab === k ? "opacity-70" : "text-ink-400"}>{counts[k]}</span>
                  </button>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {coaches.length > 1 && (
                <select
                  aria-label={t("filters.coach")}
                  className="input h-10 w-auto py-0 text-[13px]"
                  value={coach}
                  onChange={(e) => setCoach(e.target.value)}
                >
                  <option value="">{t("filters.anyCoach")}</option>
                  {coaches.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
              <select
                aria-label={t("filters.day")}
                className="input h-10 w-auto py-0 text-[13px]"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
              >
                <option value={0}>{t("filters.anyDay")}</option>
                {ISO_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {weekdayName(d, locale, "long")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-ink-600">{t("noMatch")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((g) => (
                <Card key={g.id} g={g} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: number; sub?: string; warn?: boolean }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        warn ? "border-amber-200 bg-amber-50 text-amber-900" : "border-ink-100 bg-white"
      }`}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${warn ? "" : "text-ink-400"}`}>{label}</p>
      <p className="mt-1.5 text-2xl font-bold">{value}</p>
      {sub && <p className={`mt-0.5 text-xs ${warn ? "" : "text-ink-600"}`}>{sub}</p>}
    </div>
  );
}

function Card({ g }: { g: GroupCard }) {
  const t = useTranslations("groups");
  const labels = useLabels();
  const locale = useLocale();
  const full = g.taken >= g.max_players;
  const pct = Math.min(100, Math.round((g.taken / Math.max(1, g.max_players)) * 100));
  const today = clubDay(new Date());

  const nextToday = !!g.next && clubDay(g.next) === today;
  const nextLabel = g.next
    ? nextToday
      ? t("todayAt", { time: clubFormat(g.next, locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) })
      : clubFormat(g.next, locale, { weekday: "short", day: "numeric", month: "short" })
    : null;

  return (
    <Link
      href={`/admin/groups/${g.id}`}
      className={`flex flex-col gap-3 rounded-[20px] border bg-white p-[18px] transition-colors hover:border-ink-900 ${
        g.archived_at ? "border-dashed border-ink-200 opacity-80" : "border-ink-100"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex flex-wrap gap-1.5">
          <span className="rounded-md bg-court-50 px-2 py-0.5 text-[11px] font-semibold text-court-800">
            {labels.sport(g.sport)}
          </span>
          <span className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
            {g.kind === "dropin" ? t("kind.dropin") : <WhoFor g={g} />}
          </span>
        </span>
        {nextLabel && (
          <span
            className={`shrink-0 text-xs ${nextToday ? "font-semibold text-brand-800" : "text-ink-600"}`}
          >
            {nextLabel}
          </span>
        )}
      </span>
      <span className="text-[17px] font-bold tracking-tight text-ink-900">{g.name}</span>
      <span className="flex flex-col gap-1.5 text-[13px] text-ink-600">
        <span className="flex items-center gap-2">
          <Clock size={15} className="shrink-0 text-ink-400" aria-hidden="true" />
          {scheduleText(g, locale)}
          {g.courtName ? ` · ${g.courtName}` : ""}
        </span>
        {g.coachName && (
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-5 place-items-center rounded-full bg-court-600 text-[9px] font-bold text-white"
            >
              {initials(g.coachName)}
            </span>
            {g.coachName}
          </span>
        )}
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="flex justify-between text-xs">
          <span className="font-semibold text-ink-900">
            {g.kind === "dropin" && g.next
              ? t("bookedNext", { n: g.taken, max: g.max_players })
              : t("placesOf", { n: g.taken, max: g.max_players })}
            {full && ` · ${t("full")}`}
          </span>
          {g.waiting > 0 ? (
            <span className="font-semibold text-court-600">{t("waitingCount", { n: g.waiting })}</span>
          ) : g.requests > 0 ? (
            <span className="font-semibold text-court-600">{t("requestsCount", { n: g.requests })}</span>
          ) : (
            !full && <span className="text-ink-600">{t("placesLeft", { n: g.max_players - g.taken })}</span>
          )}
        </span>
        <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-ink-100">
          <span className="block h-full bg-brand-600" style={{ width: `${pct}%` }} />
        </span>
      </span>
      <span className="mt-auto flex items-center justify-between border-t border-ink-100 pt-3 text-[13px]">
        <span className="font-semibold text-ink-900">
          {g.kind === "dropin"
            ? t("perSession", { price: money(Number(g.price)) })
            : t("perMonth", { price: money(Number(g.price)) })}
        </span>
        {g.kind === "season" &&
          (g.unpaid > 0 ? (
            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {t("unpaidCount", { n: g.unpaid })}
            </span>
          ) : g.taken > 0 && Number(g.price) > 0 ? (
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-900">
              {t("allPaid")}
            </span>
          ) : null)}
        {g.kind === "dropin" && <span className="text-xs text-ink-600">{t("bookEachWeek")}</span>}
      </span>
    </Link>
  );
}

/** "Ages 9–12 · Beginner", "Adults · All levels" */
export function WhoFor({
  g,
}: {
  g: Pick<Group, "age_min" | "age_max" | "adults" | "level">;
}) {
  const t = useTranslations("groups");
  const who = g.adults
    ? t("adults")
    : g.age_min && g.age_max
      ? t("ages", { from: g.age_min, to: g.age_max })
      : g.age_min
        ? t("agesFrom", { from: g.age_min })
        : g.age_max
          ? t("agesTo", { to: g.age_max })
          : null;
  return <>{[who, t(`level.${g.level}`)].filter(Boolean).join(" · ")}</>;
}
