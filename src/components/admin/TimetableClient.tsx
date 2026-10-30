"use client";

import { dateLocale } from "@/lib/dateLocale";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { addDays, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import type { Booking, Court, Member, OpeningHours, Profile } from "@/types/database";
import { Ban, CalendarRange, Check, ChevronLeft, ChevronRight, Plus, Repeat, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLabels } from "@/hooks/useLabels";
import { normalizeHours, weekdayIndex } from "@/lib/openingHours";
import { closuresOnDay, type Closure } from "@/lib/closures";
import { courtColor, swatchStyle } from "@/lib/courtColors";
import { reopenCourts } from "@/app/actions/closures";
import { useReadOnly } from "@/components/admin/ReadOnly";
import CloseCourtsModal from "./CloseCourtsModal";
import { closedNotice, useClosureCourts, useClosureWhen } from "./ClosuresPanel";
import { bookingName } from "@/lib/bookingName";
import PaymentTag from "@/components/admin/PaymentTag";
import { settleClubRefunds } from "@/app/[locale]/admin/settings/payments";

export type BookingWithJoins = Booking & {
  court?: Pick<Court, "id" | "name"> | null;
  member?: (Pick<Member, "full_name"> & { phone?: string | null }) | null;
  player?: Pick<Profile, "full_name"> | null;
  /** Set for a lesson: it holds the court too. */
  coach?: { profile?: Pick<Profile, "full_name"> | null } | null;
};

export type CourtRow = Pick<Court, "id" | "name" | "surface" | "is_indoor" | "sport" | "price_per_hour"> & {
  color?: string | null;
};

/** An open match on one of the club's courts (club_open_matches). */
export type MatchInfo = { court: string | null; starts_at: string; taken: number; max_players: number };

interface Props {
  courts: CourtRow[];
  bookings: BookingWithJoins[];
  /** Closed courts (20261027_court_closures.sql). */
  closures?: Closure[];
  /** The club's opening hours: they set the grid's first and last hour. */
  openingHours?: unknown;
  matches?: MatchInfo[];
}

type Kind = "booking" | "lesson" | "group" | "match";

// One look per kind of booking: a tinted card with a coloured edge.
const TONES: Record<Kind | "played", { bg: string; bar: string; name: string; meta: string; av: string; avText: string }> = {
  booking: { bg: "#f1f9dc", bar: "#a8d832", name: "#1e3010", meta: "#4d7a08", av: "#d6f09a", avText: "#2e4d03" },
  lesson: { bg: "#eaf4fd", bar: "#378add", name: "#0c4478", meta: "#1a5ea8", av: "#c0ddf7", avText: "#0c4478" },
  group: { bg: "#111c0a", bar: "#a8d832", name: "#ffffff", meta: "#d6f09a", av: "#2e4d03", avText: "#d6f09a" },
  match: { bg: "#fdf5df", bar: "#e0a400", name: "#5c4000", meta: "#7a5600", av: "#f7e2a6", avText: "#5c4000" },
  played: { bg: "#f1f3ee", bar: "#9aa893", name: "#3d4f35", meta: "#6e7f65", av: "#e1e6dc", avText: "#3d4f35" },
};

const CLOSED_BG = {
  backgroundColor: "#f3f5f0",
  backgroundImage: "repeating-linear-gradient(135deg, rgba(110,127,101,0.16) 0 6px, transparent 6px 12px)",
};

const HOUR_H = 64;
const pad = (n: number) => String(n).padStart(2, "0");
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const money = (n: number) => `€${n.toFixed(2).replace(/\.00$/, "")}`;
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** The grid's hours: from the earliest opening to the latest closing of the week. */
function gridHours(raw: unknown) {
  const hours = normalizeHours(raw).filter((d) => d.open);
  if (!hours.length) return { first: 7, last: 22 };
  const first = Math.min(...hours.map((d) => Number(d.from.slice(0, 2))));
  const last = Math.max(...hours.map((d) => Math.ceil(Number(d.to.slice(0, 2)) + Number(d.to.slice(3)) / 60)));
  return { first: Math.min(first, 23), last: Math.max(Math.min(last, 24), first + 1) };
}

/** Minutes a club is open on a day, for the "% booked" figures. */
function openMinutes(hours: OpeningHours, day: Date) {
  const d = hours[weekdayIndex(day)];
  if (!d?.open) return 0;
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return Math.max(0, m(d.to) - m(d.from));
}

type Selection = { type: "booking"; id: string } | { type: "closure"; id: string } | null;

export default function TimetableClient({ courts, bookings, closures = [], openingHours, matches = [] }: Props) {
  const t = useTranslations("timetable");
  const tc = useTranslations("closures");
  const tCommon = useTranslations("common");
  const tPay = useTranslations("payments");
  const locale = useLocale();
  const df = dateLocale(locale);
  const labels = useLabels();
  const router = useRouter();
  const closureWhen = useClosureWhen();
  const closureCourts = useClosureCourts(courts);
  const { readOnly, hint } = useReadOnly();

  const [offset, setOffset] = useState(0);
  const [sport, setSport] = useState<string>("all");
  const [mobileCourt, setMobileCourt] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [hover, setHover] = useState<{ court: string; hour: number } | null>(null);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askSeries, setAskSeries] = useState(false);
  // Changes saved from the details panel, shown before the page reloads.
  const [patches, setPatches] = useState<Record<string, Partial<Booking>>>({});
  const [saving, startSaving] = useTransition();
  const [nowMin, setNowMin] = useState<number | null>(null);

  const today = startOfDay(new Date());
  const date = addDays(today, offset);
  const isToday = offset === 0;
  const hours = normalizeHours(openingHours);
  const { first, last } = gridHours(openingHours);
  const gridStart = first * 60;
  const gridHeight = (last - first) * HOUR_H;
  const hourRows = Array.from({ length: last - first }, (_, i) => first + i);

  // The red "now" line, moved every minute.
  useEffect(() => {
    const tick = () => setNowMin(minutesOf(new Date()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const live = bookings
    .map((b) => (patches[b.id] ? { ...b, ...patches[b.id] } : b))
    .filter((b) => b.status !== "cancelled" && b.status !== "no_show");
  const onDay = (d: Date) => live.filter((b) => isSameDay(new Date(b.starts_at), d));
  const dayBookings = onDay(date);

  const sports = [...new Set(courts.map((c) => c.sport))];
  const shownCourts = sport === "all" ? courts : courts.filter((c) => c.sport === sport);
  const phoneCourt = shownCourts.find((c) => c.id === mobileCourt) ?? shownCourts[0];

  // ---- What each booking is -----------------------------------------------
  const nameOf = (b: BookingWithJoins) =>
    bookingName(b, tCommon("walkIn"));
  const matchOf = (b: BookingWithJoins) =>
    matches.find((m) => m.court === b.court?.name && new Date(m.starts_at).getTime() === new Date(b.starts_at).getTime());
  const kindOf = (b: BookingWithJoins): Kind =>
    b.group_id ? "group" : b.coach_id ? "lesson" : matchOf(b) ? "match" : "booking";
  const tagOf = (b: BookingWithJoins) => {
    const k = kindOf(b);
    if (b.status === "pending") return b.payment_status === "pending" ? tPay("tag.pending") : t("tags.pending");
    if (k === "group")
      return b.coach?.profile?.full_name
        ? `${t("group")} · ${t("groupWith", { coach: b.coach.profile.full_name })}`
        : t("group");
    if (k === "lesson") return t("lessonWith", { coach: b.coach?.profile?.full_name ?? "" });
    if (k === "match") {
      const m = matchOf(b)!;
      return t("tags.match", { taken: m.taken, max: m.max_players });
    }
    if (b.member_id) return t("tags.member");
    if (b.player_id) return t("tags.online");
    return tCommon("walkIn");
  };
  const toneOf = (b: BookingWithJoins) => (b.status === "completed" ? TONES.played : TONES[kindOf(b)]);
  const timeOf = (b: BookingWithJoins) =>
    `${format(new Date(b.starts_at), "HH:mm")}–${format(new Date(b.ends_at), "HH:mm")}`;

  // ---- Figures --------------------------------------------------------------
  const bookedMinutes = (list: BookingWithJoins[]) =>
    list.reduce((sum, b) => sum + (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60_000, 0);
  const pctFor = (list: BookingWithJoins[], d: Date, courtCount: number) => {
    const open = openMinutes(hours, d) * courtCount;
    return open ? Math.min(100, Math.round((bookedMinutes(list) / open) * 100)) : 0;
  };
  const dayPct = pctFor(dayBookings, date, courts.length);
  const revenue = dayBookings.reduce((s, b) => s + Number(b.total_price ?? 0), 0);
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // ---- Changing a booking from the panel ------------------------------------
  const sel =
    selected?.type === "booking" ? (live.find((b) => b.id === selected.id) ?? null) : null;
  const selClosure = selected?.type === "closure" ? (closures.find((c) => c.id === selected.id) ?? null) : null;

  const save = (b: BookingWithJoins, patch: Partial<Booking>, laterWeeks = false) =>
    startSaving(async () => {
      setError(null);
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from("bookings") as any).update(patch);
      query =
        laterWeeks && b.series_id
          ? query.eq("series_id", b.series_id).gte("starts_at", b.starts_at).eq("status", "confirmed")
          : query.eq("id", b.id);
      const { error: e } = await query;
      if (e) {
        console.error("[timetable] save", e);
        setError(readOnly ? (hint ?? t("failed")) : t("failed"));
        return;
      }
      setPatches((p) => {
        const next = { ...p };
        const ids =
          laterWeeks && b.series_id
            ? bookings.filter((x) => x.series_id === b.series_id && x.starts_at >= b.starts_at).map((x) => x.id)
            : [b.id];
        for (const id of ids) next[id] = { ...next[id], ...patch };
        return next;
      });
      setAskSeries(false);
      if (patch.status === "cancelled" || patch.status === "no_show") setSelected(null);
      // Paid online: the money goes back (20261029_online_payments.sql).
      if (patch.status === "cancelled") await settleClubRefunds();
      router.refresh();
    });

  const cancel = (b: BookingWithJoins) => {
    if (b.series_id) setAskSeries(true);
    else save(b, { status: "cancelled" });
  };

  const reopen = (c: Closure) =>
    startSaving(async () => {
      const r = await reopenCourts(c.id);
      if (r.error) {
        setError(tc(`errors.${r.error}`));
        return;
      }
      setSelected(null);
      setNotice(tc("reopened"));
      router.refresh();
    });

  const open = (b: BookingWithJoins) => {
    // A group's session opens the group.
    if (b.group_id) {
      router.push(`/admin/groups/${b.group_id}`);
      return;
    }
    setError(null);
    setAskSeries(false);
    setSelected({ type: "booking", id: b.id });
  };

  const addHref = (courtId?: string, hour?: number) => {
    const p = new URLSearchParams({ new: "1", date: format(date, "yyyy-MM-dd") });
    if (courtId) p.set("court", courtId);
    if (hour !== undefined) p.set("hour", String(hour));
    return `/admin/bookings?${p.toString()}`;
  };

  // A whole hour on a court with nothing booked or closed, and not yet passed.
  const isFreeHour = (courtId: string, hour: number) => {
    const s = new Date(date);
    s.setHours(hour, 0, 0, 0);
    const e = new Date(s.getTime() + 60 * 60_000);
    if (s < new Date() || hour + 1 > last) return false;
    if (closuresOnDay(closures, courtId, date).some((c) => new Date(c.starts_at) < e && new Date(c.ends_at) > s))
      return false;
    return !dayBookings.some(
      (b) => b.court?.id === courtId && new Date(b.starts_at) < e && new Date(b.ends_at) > s,
    );
  };

  if (courts.length === 0) {
    return (
      <div>
        <h1 className="m-0 text-[22px] font-semibold text-[#111c0a]">{t("title")}</h1>
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-[#d0d9c9] bg-white px-6 py-16 text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-xl bg-[#f3fbde] text-[#4d7a08]">
            <CalendarRange size={22} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-[#111c0a]">{t("noCourts")}</h2>
          <p className="mt-1 max-w-sm text-sm text-[#6e7f65]">{t("noCourtsHint")}</p>
          <Link href="/admin/courts" className="btn-primary mt-6">
            {t("addCourt")}
          </Link>
        </div>
      </div>
    );
  }

  // ---- Pieces ---------------------------------------------------------------
  const card = (b: BookingWithJoins, style: React.CSSProperties, compact: boolean) => {
    const tone = toneOf(b);
    const on = selected?.type === "booking" && selected.id === b.id;
    const name = nameOf(b);
    return (
      <button
        key={b.id}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          open(b);
        }}
        onMouseMove={(e) => e.stopPropagation()}
        aria-label={`${name}, ${timeOf(b)}`}
        aria-pressed={on}
        className="flex flex-col gap-1 overflow-hidden rounded-xl px-3 py-2 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111c0a]"
        style={{
          ...style,
          background: tone.bg,
          border: b.status === "pending" ? "1.5px dashed #6e7f65" : "0",
          boxShadow: `inset 4px 0 0 ${tone.bar}${on ? ", 0 0 0 2px #111c0a, 0 10px 24px -12px rgba(17,28,10,0.45)" : ""}`,
        }}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-bold"
            style={{ background: tone.av, color: tone.avText }}
          >
            {kindOf(b) === "group" ? "GR" : initialsOf(name)}
          </span>
          <span className="min-w-0 truncate text-[13px] font-bold" style={{ color: tone.name }}>
            {name}
          </span>
          {b.series_id && <Repeat size={12} aria-hidden="true" className="shrink-0 opacity-70" style={{ color: tone.name }} />}
          {b.checked_in_at && <Check size={13} aria-hidden="true" className="shrink-0" style={{ color: tone.meta }} />}
        </span>
        {!compact && (
          <span className="truncate text-[11px] font-medium" style={{ color: tone.meta }}>
            {timeOf(b)} · {tagOf(b)}
          </span>
        )}
      </button>
    );
  };

  const legend: [string, React.CSSProperties][] = [
    [t("legend.booking"), { background: TONES.booking.bar }],
    [t("legend.lesson"), { background: TONES.lesson.bar }],
    [t("group"), { background: "#111c0a" }],
    [t("legend.match"), { background: TONES.match.bar }],
    [t("tags.pending"), { border: "1.5px dashed #6e7f65" }],
    [tc("closed"), { ...CLOSED_BG, border: "1px solid #c9d2c2" }],
  ];

  const details = (sel || selClosure) && (
    <aside
      aria-label={t("details.title")}
      className="fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-[#e8ede4] bg-white p-5 shadow-[0_-12px_40px_-12px_rgba(17,28,10,0.35)] lg:static lg:z-auto lg:max-h-none lg:w-[340px] lg:shrink-0 lg:rounded-[20px] lg:shadow-none"
    >
      <div className="flex items-start justify-between gap-3">
        {sel ? (
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-full text-[15px] font-bold"
              style={{ background: toneOf(sel).av, color: toneOf(sel).avText }}
            >
              {initialsOf(nameOf(sel))}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-bold text-[#111c0a]">{nameOf(sel)}</h2>
              <p className="text-xs text-[#3d4f35]">
                {kindOf(sel) === "lesson"
                  ? t("lessonWith", { coach: sel.coach?.profile?.full_name ?? "" })
                  : kindOf(sel) === "match"
                    ? t("legend.match")
                    : sel.member_id
                      ? t("details.member")
                      : sel.player_id
                        ? t("details.online")
                        : tCommon("walkIn")}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-[#f3f5f0] text-[#3d4f35]">
              <Ban size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-[#111c0a]">
                {tc("closed")} · {tc(`reasons.${selClosure!.reason}`)}
              </h2>
              <p className="text-xs text-[#3d4f35]">{closureCourts(selClosure!)}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setSelected(null)}
          aria-label={t("details.close")}
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f3f5f0] text-[#3d4f35] hover:text-[#111c0a]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {sel && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                sel.status === "pending" ? "bg-[#f3f5f0] text-[#3d4f35]" : "bg-[#f1f9dc] text-[#2e4d03]"
              }`}
            >
              {labels.bookingStatus(sel.status)}
            </span>
            <PaymentTag status={sel.payment_status} className="py-1 text-xs" />
            {sel.checked_in_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf4fd] px-2.5 py-1 text-xs font-semibold text-[#0c4478]">
                <Check size={12} aria-hidden="true" />
                {t("details.checkedIn", { time: format(new Date(sel.checked_in_at), "HH:mm") })}
              </span>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-[92px_minmax(0,1fr)] gap-x-2 gap-y-2.5 text-[13px]">
            <dt className="text-[#6e7f65]">{t("details.when")}</dt>
            <dd className="m-0 font-semibold text-[#111c0a]">
              {format(new Date(sel.starts_at), "EEE d MMM", { locale: df })}, {timeOf(sel)}
            </dd>
            <dt className="text-[#6e7f65]">{t("details.court")}</dt>
            <dd className="m-0 text-[#111c0a]">{sel.court?.name ?? "—"}</dd>
            <dt className="text-[#6e7f65]">{t("details.price")}</dt>
            <dd className="m-0 text-[#111c0a]">{money(Number(sel.total_price ?? 0))}</dd>
            <dt className="text-[#6e7f65]">{t("details.repeats")}</dt>
            <dd className="m-0 text-[#111c0a]">
              {sel.series_id
                ? t("details.weeklyUntil", {
                    date: format(
                      new Date(
                        bookings
                          .filter((x) => x.series_id === sel.series_id)
                          .reduce((m, x) => (x.starts_at > m ? x.starts_at : m), sel.starts_at),
                      ),
                      "d MMM",
                      { locale: df },
                    ),
                  })
                : t("details.once")}
            </dd>
            {sel.member?.phone && (
              <>
                <dt className="text-[#6e7f65]">{t("details.phone")}</dt>
                <dd className="m-0">
                  <a href={`tel:${sel.member.phone.replace(/\s/g, "")}`} className="text-[#2e4d03] underline-offset-2 hover:underline">
                    {sel.member.phone}
                  </a>
                </dd>
              </>
            )}
            {sel.notes && (
              <>
                <dt className="text-[#6e7f65]">{t("details.notes")}</dt>
                <dd className="m-0 whitespace-pre-line text-[#111c0a]">{sel.notes}</dd>
              </>
            )}
            <dt className="text-[#6e7f65]">{t("details.reference")}</dt>
            <dd className="m-0 text-[#3d4f35]">{sel.reference}</dd>
          </dl>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {askSeries ? (
            <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-[#f6f7f4] p-3">
              <p className="text-[13px] text-[#3d4f35]">{t("details.cancelAsk")}</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(sel, { status: "cancelled" })}
                className="action action-danger action-lg h-10 text-[13px]"
              >
                {t("details.cancelThis")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(sel, { status: "cancelled" }, true)}
                className="action action-danger action-lg h-10 text-[13px]"
              >
                {t("details.cancelLater")}
              </button>
              <button type="button" onClick={() => setAskSeries(false)} className="h-9 text-[13px] text-[#3d4f35]">
                {t("details.keep")}
              </button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {!sel.checked_in_at && sel.status !== "completed" && (
                <button
                  type="button"
                  disabled={readOnly || saving}
                  title={hint}
                  onClick={() => save(sel, { checked_in_at: new Date().toISOString() })}
                  className="col-span-2 h-11 rounded-full bg-[#111c0a] text-sm font-semibold text-white hover:bg-[#1e3010] disabled:opacity-50"
                >
                  {t("details.checkIn")}
                </button>
              )}
              <Link
                href="/admin/bookings"
                className="grid h-10 place-items-center rounded-full border border-[#d0d9c9] bg-white text-[13px] font-medium text-[#111c0a] hover:border-[#111c0a]"
              >
                {t("details.openBookings")}
              </Link>
              <button
                type="button"
                disabled={readOnly || saving || new Date(sel.starts_at) > new Date()}
                title={new Date(sel.starts_at) > new Date() ? t("details.noShowLater") : hint}
                onClick={() => save(sel, { status: "no_show" })}
                className="h-10 rounded-full border border-[#d0d9c9] bg-white text-[13px] font-medium text-[#111c0a] hover:border-[#111c0a] disabled:opacity-50"
              >
                {labels.bookingStatus("no_show")}
              </button>
              {sel.status !== "completed" && (
                <button
                  type="button"
                  disabled={readOnly || saving}
                  title={hint}
                  onClick={() => cancel(sel)}
                  className="action action-danger action-lg col-span-2 h-10 text-[13px]"
                >
                  {t("details.cancel")}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {selClosure && (
        <>
          <dl className="mt-4 grid grid-cols-[92px_minmax(0,1fr)] gap-x-2 gap-y-2.5 text-[13px]">
            <dt className="text-[#6e7f65]">{t("details.when")}</dt>
            <dd className="m-0 font-semibold text-[#111c0a]">{closureWhen(selClosure)}</dd>
            {selClosure.note && (
              <>
                <dt className="text-[#6e7f65]">{t("details.notes")}</dt>
                <dd className="m-0 text-[#111c0a]">{selClosure.note}</dd>
              </>
            )}
          </dl>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={readOnly || saving}
            title={hint ?? tc("reopenHint")}
            onClick={() => reopen(selClosure)}
            className="mt-4 h-10 w-full rounded-full border border-[#d0d9c9] bg-white text-[13px] font-medium text-[#111c0a] hover:border-[#111c0a] disabled:opacity-50"
          >
            {saving ? tc("reopening") : tc("reopen")}
          </button>
        </>
      )}
    </aside>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[26px] font-extrabold tracking-tight text-[#111c0a] first-letter:uppercase">
            {format(date, "EEEE, d MMMM", { locale: df })}
          </h1>
          <p className="mt-1 text-sm text-[#3d4f35]">
            {dayBookings.length === 0
              ? t("noBookings")
              : t("summary", { n: dayBookings.length, pct: dayPct, revenue: money(revenue) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOffset(0)}
            disabled={isToday}
            className="h-10 rounded-[10px] border border-[#d0d9c9] bg-white px-4 text-[13px] font-medium text-[#3d4f35] hover:bg-[#f4f6f2] disabled:opacity-50"
          >
            {t("today")}
          </button>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setClosing(true);
            }}
            disabled={readOnly}
            title={hint}
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#d0d9c9] bg-white px-3.5 text-[13px] font-medium text-[#3d4f35] hover:bg-[#f4f6f2] disabled:opacity-50"
          >
            <Ban size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{tc("button")}</span>
          </button>
          <Link
            href={addHref()}
            aria-disabled={readOnly}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full bg-[#111c0a] px-4 text-[13px] font-semibold text-white hover:bg-[#1e3010] ${
              readOnly ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <Plus size={15} aria-hidden="true" />
            {t("addBooking")}
          </Link>
        </div>
      </div>

      {/* Week strip */}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 7)}
          aria-label={t("prevWeek")}
          className="grid w-10 shrink-0 place-items-center rounded-xl border border-[#e8ede4] bg-white text-[#3d4f35] hover:bg-[#f4f6f2]"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5">
          {week.map((d) => {
            const on = isSameDay(d, date);
            const pct = pctFor(onDay(d), d, courts.length);
            return (
              <button
                key={d.toISOString()}
                type="button"
                aria-pressed={on}
                aria-label={`${format(d, "EEEE d MMMM", { locale: df })}, ${t("booked", { pct })}`}
                onClick={() => setOffset(Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000))}
                className={`flex min-w-[64px] flex-1 flex-col items-center gap-1 rounded-[14px] border px-2 py-2 transition-colors ${
                  on ? "border-[#111c0a] bg-[#111c0a] text-white" : "border-[#e8ede4] bg-white text-[#111c0a] hover:border-[#c9d2c2]"
                }`}
              >
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${on ? "text-white/70" : "text-[#6e7f65]"}`}>
                  {isSameDay(d, today) ? t("today") : format(d, "EEE", { locale: df })}
                </span>
                <span className="text-lg leading-tight font-bold">{format(d, "d")}</span>
                <span aria-hidden="true" className={`block h-1 w-10 overflow-hidden rounded-full ${on ? "bg-white/20" : "bg-[#eef1ea]"}`}>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct}%`, background: pct > 85 ? "#e0a400" : "#a8d832" }}
                  />
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 7)}
          aria-label={t("nextWeek")}
          className="grid w-10 shrink-0 place-items-center rounded-xl border border-[#e8ede4] bg-white text-[#3d4f35] hover:bg-[#f4f6f2]"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Legend and sport filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="hidden flex-wrap gap-x-4 gap-y-2 text-xs text-[#3d4f35] md:flex">
          {legend.map(([label, style]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={style} />
              {label}
            </span>
          ))}
        </div>
        {sports.length > 1 && (
          <div role="group" aria-label={t("sport")} className="flex gap-1.5">
            {["all", ...sports].map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={sport === s}
                onClick={() => setSport(s)}
                className={`h-8 rounded-full border px-3.5 text-xs font-medium ${
                  sport === s ? "border-[#111c0a] bg-[#111c0a] text-white" : "border-[#d0d9c9] bg-white text-[#3d4f35]"
                }`}
              >
                {s === "all" ? t("allCourts") : labels.sport(s)}
              </button>
            ))}
          </div>
        )}
      </div>

      {notice && (
        <p role="status" className="rounded-lg bg-[#f3fbde] px-4 py-2.5 text-sm text-[#2e4d03]">
          {notice}
        </p>
      )}

      <div className="flex items-start gap-5">
        {/* ---- Desktop grid ---- */}
        <div className="hidden min-w-0 flex-1 overflow-hidden rounded-[20px] border border-[#e8ede4] bg-white md:block">
          <div className="overflow-x-auto">
            <div style={{ minWidth: 64 + shownCourts.length * 170 }}>
              {/* Court headers */}
              <div
                className="sticky top-0 z-[4] grid border-b border-[#e8ede4] bg-white"
                style={{ gridTemplateColumns: `64px repeat(${shownCourts.length}, minmax(0, 1fr))` }}
              >
                <div />
                {shownCourts.map((c) => {
                  const pct = pctFor(dayBookings.filter((b) => b.court?.id === c.id), date, 1);
                  return (
                    <div key={c.id} className="flex min-w-0 items-center gap-2.5 border-l border-[#f0f3ec] px-3.5 py-3">
                      <span aria-hidden="true" className="size-[26px] shrink-0 rounded-lg ring-[3px] ring-inset ring-white/50" style={swatchStyle(courtColor(c))} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-bold text-[#111c0a]">{c.name}</span>
                        <span className="truncate text-[11px] text-[#6e7f65]">
                          {labels.sport(c.sport)} · {labels.surface(c.surface)} · {labels.inOut(c.is_indoor)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-[#f3f5f0] px-2 py-0.5 text-[11px] font-semibold text-[#3d4f35]">
                        {t("booked", { pct })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Body */}
              <div
                className="relative grid"
                style={{ gridTemplateColumns: `64px repeat(${shownCourts.length}, minmax(0, 1fr))` }}
              >
                <div className="relative" style={{ height: gridHeight }}>
                  {hourRows.map((h, i) => (
                    <span
                      key={h}
                      className="absolute right-2.5 bg-white px-0.5 text-[11px] font-medium text-[#6e7f65]"
                      style={{ top: i === 0 ? 4 : i * HOUR_H - 7 }}
                    >
                      {pad(h)}:00
                    </span>
                  ))}
                </div>

                {shownCourts.map((c) => (
                  <div
                    key={c.id}
                    className="relative border-l border-[#f0f3ec]"
                    style={{
                      height: gridHeight,
                      backgroundImage:
                        "linear-gradient(#eef1ea 1px, transparent 1px), linear-gradient(#f6f8f3 1px, transparent 1px)",
                      backgroundSize: `100% ${HOUR_H}px, 100% ${HOUR_H / 2}px`,
                    }}
                    onMouseMove={(e) => {
                      const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                      const hour = first + Math.floor(y / HOUR_H);
                      if (hover?.court !== c.id || hover.hour !== hour) setHover({ court: c.id, hour });
                    }}
                    onMouseLeave={() => setHover(null)}
                  >
                    {/* Closed times */}
                    {closuresOnDay(closures, c.id, date).map((z) => {
                      const from = Math.max((new Date(z.starts_at).getTime() - date.getTime()) / 60_000, gridStart);
                      const to = Math.min((new Date(z.ends_at).getTime() - date.getTime()) / 60_000, last * 60);
                      if (to <= from) return null;
                      return (
                        <button
                          key={z.id}
                          type="button"
                          onClick={() => setSelected({ type: "closure", id: z.id })}
                          onMouseMove={(e) => e.stopPropagation()}
                          aria-label={`${tc("closed")}: ${tc(`reasons.${z.reason}`)}`}
                          className="absolute inset-x-0 flex justify-center pt-3.5"
                          style={{ top: ((from - gridStart) / 60) * HOUR_H, height: ((to - from) / 60) * HOUR_H, ...CLOSED_BG }}
                        >
                          <span className="h-fit rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#3d4f35] shadow-sm">
                            {tc("closed")} · {tc(`reasons.${z.reason}`)}
                          </span>
                        </button>
                      );
                    })}

                    {/* Free hour under the mouse: one click to book it */}
                    {hover?.court === c.id && !readOnly && isFreeHour(c.id, hover.hour) && (
                      <Link
                        href={addHref(c.id, hover.hour)}
                        className="absolute inset-x-1.5 grid place-items-center rounded-xl border-[1.5px] border-dashed border-[#a8d832] bg-[#fbfdf6] text-[13px] font-semibold text-[#4d7a08]"
                        style={{ top: (hover.hour - first) * HOUR_H + 3, height: HOUR_H - 6 }}
                      >
                        + {pad(hover.hour)}:00
                      </Link>
                    )}

                    {/* Bookings */}
                    {dayBookings
                      .filter((b) => b.court?.id === c.id)
                      .map((b) => {
                        const start = minutesOf(new Date(b.starts_at));
                        const h = ((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 3_600_000) * HOUR_H - 6;
                        return card(
                          b,
                          { position: "absolute", left: 6, right: 6, top: ((start - gridStart) / 60) * HOUR_H + 3, height: h },
                          h < 50,
                        );
                      })}
                  </div>
                ))}

                {/* Now */}
                {isToday && nowMin !== null && nowMin >= gridStart && nowMin <= last * 60 && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 z-[3] border-t-2 border-[#7aad12]"
                    style={{ top: ((nowMin - gridStart) / 60) * HOUR_H }}
                  >
                    <span className="absolute -top-[11px] left-1.5 rounded-full bg-[#7aad12] px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {hhmm(nowMin)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ---- Phone: one court at a time, as a list ---- */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:hidden">
          <div role="tablist" aria-label={t("courts")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
            {shownCourts.map((c) => {
              const on = c.id === phoneCourt?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setMobileCourt(c.id)}
                  className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold ${
                    on ? "border-[#111c0a] bg-[#111c0a] text-white" : "border-[#d0d9c9] bg-white text-[#3d4f35]"
                  }`}
                >
                  <span aria-hidden="true" className="size-3 rounded" style={swatchStyle(courtColor(c))} />
                  {c.name}
                </button>
              );
            })}
          </div>
          {phoneCourt && (
            <PhoneAgenda
              key={`${phoneCourt.id}-${offset}`}
              items={[
                ...dayBookings
                  .filter((b) => b.court?.id === phoneCourt.id)
                  .map((b) => ({ kind: "booking" as const, start: minutesOf(new Date(b.starts_at)), end: minutesOf(new Date(b.ends_at)) || 24 * 60, b })),
                ...closuresOnDay(closures, phoneCourt.id, date).map((z) => ({
                  kind: "closed" as const,
                  start: Math.max((new Date(z.starts_at).getTime() - date.getTime()) / 60_000, gridStart),
                  end: Math.min((new Date(z.ends_at).getTime() - date.getTime()) / 60_000, last * 60),
                  z,
                })),
              ]}
              gridStart={gridStart}
              gridEnd={last * 60}
              card={(b) => card(b, { minHeight: 60, flex: 1, minWidth: 0 }, false)}
              onClosure={(z) => setSelected({ type: "closure", id: z.id })}
              freeLabel={(until) => t("freeUntil", { time: until })}
              closedLabel={(z, until) => `${tc("closed")} · ${tc(`reasons.${z.reason}`)} · ${until}`}
              addHref={(hour) => addHref(phoneCourt.id, hour)}
              canAdd={!readOnly}
              nowMin={isToday ? nowMin : offset < 0 ? 24 * 60 : -1}
            />
          )}
        </div>

        {details}
      </div>

      {/* Phone: dim the page behind the details sheet */}
      {(sel || selClosure) && (
        <button
          type="button"
          aria-label={t("details.close")}
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      )}

      <CloseCourtsModal
        open={closing}
        onClose={() => setClosing(false)}
        courts={courts}
        day={format(date, "yyyy-MM-dd")}
        onDone={(r) => {
          setClosing(false);
          setNotice(closedNotice(tc, r));
          router.refresh();
        }}
      />
    </div>
  );
}

/** The phone view of one court's day: bookings, closures and the free gaps between. */
function PhoneAgenda({
  items,
  gridStart,
  gridEnd,
  card,
  onClosure,
  freeLabel,
  closedLabel,
  addHref,
  canAdd,
  nowMin,
}: {
  items: (
    | { kind: "booking"; start: number; end: number; b: BookingWithJoins }
    | { kind: "closed"; start: number; end: number; z: Closure }
  )[];
  gridStart: number;
  gridEnd: number;
  card: (b: BookingWithJoins) => React.ReactNode;
  onClosure: (z: Closure) => void;
  freeLabel: (until: string) => string;
  closedLabel: (z: Closure, until: string) => string;
  addHref: (hour: number) => string;
  canAdd: boolean;
  /** Minutes past midnight now; free time before it isn't offered. */
  nowMin: number | null;
}) {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const rows: React.ReactNode[] = [];
  let cursor = gridStart;
  const free = (from: number, to: number) => {
    // Free time starts on the next whole hour that hasn't passed.
    const start = Math.max(from, nowMin !== null && nowMin >= 0 ? Math.ceil(nowMin / 60) * 60 : from);
    const hour = Math.ceil(start / 60);
    if (hour * 60 + 60 > to) return;
    rows.push(
      <div key={`free-${from}`} className="flex items-stretch gap-2.5">
        <span className="w-11 shrink-0 pt-3 text-xs font-semibold text-[#6e7f65]">{hhmm(hour * 60)}</span>
        {canAdd ? (
          <Link
            href={addHref(hour)}
            className="flex min-h-11 flex-1 items-center rounded-xl border-[1.5px] border-dashed border-[#c5e27d] bg-[#fbfdf6] px-3.5 text-[13px] font-semibold text-[#4d7a08]"
          >
            + {freeLabel(hhmm(to))}
          </Link>
        ) : (
          <span className="flex min-h-11 flex-1 items-center rounded-xl border border-dashed border-[#d0d9c9] px-3.5 text-[13px] text-[#6e7f65]">
            {freeLabel(hhmm(to))}
          </span>
        )}
      </div>,
    );
  };
  for (const it of sorted) {
    if (it.start > cursor) free(cursor, it.start);
    rows.push(
      <div key={`${it.kind}-${it.start}`} className="flex items-stretch gap-2.5">
        <span className="w-11 shrink-0 pt-3 text-xs font-semibold text-[#6e7f65]">{hhmm(it.start)}</span>
        {it.kind === "booking" ? (
          card(it.b)
        ) : (
          <button
            type="button"
            onClick={() => onClosure(it.z)}
            className="flex min-h-11 flex-1 items-center rounded-xl px-3.5 text-left text-[13px] font-semibold text-[#3d4f35]"
            style={CLOSED_BG}
          >
            {closedLabel(it.z, hhmm(it.end))}
          </button>
        )}
      </div>,
    );
    cursor = Math.max(cursor, it.end);
  }
  if (cursor < gridEnd) free(cursor, gridEnd);
  return <div className="flex flex-col gap-2">{rows}</div>;
}
