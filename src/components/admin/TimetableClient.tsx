"use client";

import { dateLocale } from "@/lib/dateLocale";
import { useLocale, useTranslations } from "next-intl";
import { useState, useEffect, useRef, useTransition } from "react";
import { format, addDays, startOfDay } from "date-fns";
import type { Booking, Court, Member, Profile } from "@/types/database";
import { Ban, CalendarRange } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useLabels } from "@/hooks/useLabels";
import { DAY_HOURS } from "@/lib/openingHours";
import { closuresOnDay, type Closure } from "@/lib/closures";
import { reopenCourts } from "@/app/actions/closures";
import { useReadOnly } from "@/components/admin/ReadOnly";
import CloseCourtsModal from "./CloseCourtsModal";
import { closedNotice, useClosureCourts, useClosureWhen } from "./ClosuresPanel";

export type BookingWithJoins = Booking & {
  court?: Pick<Court, "id" | "name"> | null;
  member?: Pick<Member, "full_name"> | null;
  player?: Pick<Profile, "full_name"> | null;
  /** Set for a lesson: it holds the court too. */
  coach?: { profile?: Pick<Profile, "full_name"> | null } | null;
};

export type CourtRow = Pick<Court, "id" | "name" | "surface" | "is_indoor" | "sport">;
interface Props {
  courts: CourtRow[];
  bookings: BookingWithJoins[];
  /** Closed courts (20261027_court_closures.sql). */
  closures?: Closure[];
}

const HOURS = DAY_HOURS;
const SLOTS_PER_HOUR = 2;
const SLOT_H = 64;
const TIME_W = 90;
const DAY_START_MIN = 7 * 60;

const STATUS_STYLES: Record<
  string,
  { wrapper: string; dot: string; badge: string }
> = {
  confirmed: {
    wrapper: "bg-[#e4f7b8] border-l-[#7aad12]",
    dot: "bg-[#7aad12]",
    badge: "bg-[#d6f0a0] text-[#2e4d03]",
  },
  completed: {
    wrapper: "bg-[#e8ede4] border-l-[#3d4f35]",
    dot: "bg-[#3d4f35]",
    badge: "bg-[#d4dccf] text-[#111c0a]",
  },
  pending: {
    wrapper: "bg-[#e8f4fd] border-l-[#378add]",
    dot: "bg-[#378add]",
    badge: "bg-[#cce6fa] text-[#0c4478]",
  },
  cancelled: {
    wrapper: "bg-[#f4f6f2] border-l-[#6e7f65]",
    dot: "bg-[#6e7f65]",
    badge: "bg-[#e8ede4] text-[#3d4f35]",
  },
};

const STATUS_TEXT_COLORS: Record<string, { name: string; time: string }> = {
  confirmed: { name: "text-[#2e4d03]", time: "text-[#4d7a08]" },
  completed: { name: "text-[#111c0a]", time: "text-[#1e3010]" },
  pending: { name: "text-[#0c4478]", time: "text-[#1a5ea8]" },
  cancelled: { name: "text-[#3d4f35]", time: "text-[#6e7f65]" },
};

// A group's session: dark, so it stands apart from single bookings.
const GROUP_STYLE = {
  wrapper: "bg-[#111c0a] border-l-[#a8d832]",
  dot: "bg-[#111c0a]",
  badge: "bg-[#111c0a] text-white",
};
const GROUP_TEXT = { name: "text-white", time: "text-[#d6f09a]" };

// A closed court: grey stripes, under the bookings' colours.
const CLOSED_BG = {
  backgroundColor: "#f4f6f2",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(110,127,101,0.16) 0 6px, transparent 6px 12px)",
};

const HALF_SLOTS = HOURS.flatMap((h) => [
  { hour: h, half: 0, label: `${String(h).padStart(2, "0")}:00` },
  { hour: h, half: 1, label: `${String(h).padStart(2, "0")}:30` },
]);

function getBookingName(b: BookingWithJoins, walkIn: string) {
  return b.member?.full_name ?? b.player?.full_name ?? b.walk_in_name ?? walkIn;
}

function getBookingsForCourt(
  bookings: BookingWithJoins[],
  courtId: string,
  date: Date,
) {
  return bookings.filter((b) => {
    if (b.court?.id !== courtId) return false;
    return (
      format(new Date(b.starts_at), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    );
  });
}

function timeToMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export default function TimetableClient({ courts, bookings, closures = [] }: Props) {
  const t = useTranslations("timetable");
  const tc = useTranslations("closures");
  const closureWhen = useClosureWhen();
  const closureCourts = useClosureCourts(courts);
  const { readOnly, hint } = useReadOnly();
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [closureTip, setClosureTip] = useState<{ closure: Closure; x: number; y: number } | null>(null);
  const [reopening, startReopen] = useTransition();
  const dfLocale = dateLocale(useLocale());
  const tCommon = useTranslations("common");
  const labels = useLabels();
  const router = useRouter();
  const [wrapWidth, setWrapWidth] = useState(600);
  const [offset, setOffset] = useState(0);
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    booking: BookingWithJoins;
    x: number;
    y: number;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const date = addDays(startOfDay(new Date()), offset);
  const isToday = offset === 0;
  const totalSlots = HOURS.length * SLOTS_PER_HOUR;
  const gridHeight = totalSlots * SLOT_H;

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const min = timeToMinutes(now);
      if (min >= DAY_START_MIN && min <= DAY_START_MIN + totalSlots * 30) {
        setNowMin(min);
      } else {
        setNowMin(null);
      }
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [totalSlots]);

  useEffect(() => {
    if (!wrapRef.current) return;
    setWrapWidth(wrapRef.current.offsetWidth);
    const obs = new ResizeObserver((e) => setWrapWidth(e[0].contentRect.width));
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  const handleBookingClick = (
    e: React.MouseEvent,
    booking: BookingWithJoins,
  ) => {
    e.stopPropagation();
    // A group's session opens the group.
    if (booking.group_id) {
      router.push(`/admin/groups/${booking.group_id}`);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    if (!wrapRect) return;
    setTooltip({
      booking,
      x: rect.left - wrapRect.left + rect.width / 2,
      y: rect.top - wrapRect.top,
    });
  };

  const nowTopPx =
    isToday && nowMin !== null
      ? ((nowMin - DAY_START_MIN) / 30) * SLOT_H
      : null;

  if (courts.length === 0) {
    return (
      <div>
        <h1 className="text-[22px] font-semibold text-[#111c0a] m-0">
          {t("title")}
        </h1>
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-[#d0d9c9] bg-white px-6 py-16 text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-xl bg-[#f3fbde] text-[#4d7a08]">
            <CalendarRange size={22} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-[#111c0a]">
            {t("noCourts")}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-[#6e7f65]">
            {t("noCourtsHint")}
          </p>
          <Link href="/admin/courts" className="btn-primary mt-6">
            {t("addCourt")}
          </Link>
        </div>
      </div>
    );
  }

  const dayHasBookings = bookings.some(
    (b) =>
      format(new Date(b.starts_at), "yyyy-MM-dd") ===
      format(date, "yyyy-MM-dd"),
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[#111c0a] m-0">
            {t("title")}
          </h1>
          <p className="text-sm text-[#6e7f65] mt-1">
            {format(date, "EEEE, d MMMM yyyy", { locale: dfLocale })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setClosing(true);
            }}
            disabled={readOnly}
            title={hint}
            className="mr-1 inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-[0.5px] border-[#d0d9c9] bg-white px-3 text-[13px] font-medium text-[#3d4f35] transition-colors hover:bg-[#f4f6f2] disabled:opacity-50"
          >
            <Ban size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{tc("button")}</span>
          </button>
          <button
            onClick={() => setOffset(0)}
            className={`text-[13px] font-medium px-4 py-[7px] rounded-lg border border-[0.5px] cursor-pointer transition-colors ${
              offset === 0
                ? "bg-[#7aad12] border-[#7aad12] text-white"
                : "bg-white border-[#d0d9c9] text-[#3d4f35] hover:bg-[#f4f6f2]"
            }`}
          >
            {t("today")}
          </button>
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="w-[34px] h-[34px] rounded-lg border border-[0.5px] border-[#d0d9c9] bg-white cursor-pointer text-lg text-[#3d4f35] flex items-center justify-center hover:bg-[#f4f6f2] transition-colors"
          >
            ‹
          </button>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="w-[34px] h-[34px] rounded-lg border border-[0.5px] border-[#d0d9c9] bg-white cursor-pointer text-lg text-[#3d4f35] flex items-center justify-center hover:bg-[#f4f6f2] transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {Object.entries(STATUS_STYLES).map(([status, s]) => (
          <div
            key={status}
            className="flex items-center gap-1.5 text-xs text-[#3d4f35]"
          >
            <div
              className={`w-2.5 h-2.5 rounded-[3px] border-2 ${s.dot} opacity-80`}
            />
            <span>{labels.bookingStatus(status)}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-[#3d4f35]">
          <div className="w-2.5 h-2.5 rounded-[3px] bg-[#111c0a]" />
          <span>{t("group")}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#3d4f35]">
          <div className="w-2.5 h-2.5 rounded-[3px] border border-[#9aa893]" style={CLOSED_BG} />
          <span>{tc("closed")}</span>
        </div>
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-lg bg-[#f3fbde] px-4 py-2.5 text-sm text-[#2e4d03]">
          {notice}
        </p>
      )}

      {!dayHasBookings && (
        <p className="mb-4 rounded-lg bg-[#f4f6f2] px-4 py-2.5 text-sm text-[#3d4f35]">
          {t("noBookings")}
        </p>
      )}

      {/* Grid */}
      <div
        ref={wrapRef}
        className="bg-white border border-[0.5px] border-[#e8ede4] rounded-2xl overflow-hidden relative"
        onClick={() => {
          setTooltip(null);
          setClosureTip(null);
        }}
      >
        {/* Column headers */}
        <div
          className="grid sticky top-0 z-4 bg-white border-b border-[#e8ede4]"
          style={{
            gridTemplateColumns: `${TIME_W}px repeat(${courts.length}, minmax(0,1fr))`,
          }}
        >
          <div className="bg-[#f4f6f2] p-[14px_8px]" />
          {courts.map((c) => (
            <div
              key={c.id}
              className="bg-white px-3 py-[14px] border-l border-[0.5px] border-[#e8ede4] text-center"
            >
              <div className="text-[15px] font-semibold text-[#1a5ea8]">
                {c.name}
              </div>
              <div className="text-xs text-[#6e7f65] mt-[3px]">
                {labels.sport(c.sport)} · {labels.surface(c.surface)} ·{" "}
                {labels.inOut(c.is_indoor)}
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="relative">
          {/* Now line */}
          {nowTopPx !== null && (
            <div
              className="absolute left-0 right-0 h-[2px] bg-[#7aad12] z-3 pointer-events-none"
              style={{ top: nowTopPx }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full bg-[#7aad12] absolute -top-1"
                style={{ left: TIME_W - 5 }}
              />
            </div>
          )}

          <div
            className="grid"
            style={{
              gridTemplateColumns: `${TIME_W}px repeat(${courts.length}, minmax(0,1fr))`,
            }}
          >
            {/* Time column */}
            <div className="bg-[#f4f6f2] border-r border-[0.5px] border-[#e8ede4]">
              {HALF_SLOTS.map((slot, i) => (
                <div
                  key={i}
                  className={`border-b border-[0.5px] border-[#e8ede4] px-2.5 pt-1.5 box-border text-xs ${
                    slot.half === 0
                      ? "font-medium text-[#3d4f35]"
                      : "font-normal text-[#6e7f65]"
                  }`}
                  style={{ height: SLOT_H }}
                >
                  {slot.label}
                </div>
              ))}
            </div>

            {/* Court columns */}
            {courts.map((court) => {
              const courtBookings = getBookingsForCourt(
                bookings,
                court.id,
                date,
              );
              return (
                <div
                  key={court.id}
                  className="border-l border-[0.5px] border-[#e8ede4] relative"
                  style={{ height: gridHeight }}
                >
                  {/* Slot lines */}
                  {HALF_SLOTS.map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-b border-[0.5px] border-[#e8ede4] box-border"
                      style={{ top: i * SLOT_H, height: SLOT_H }}
                    />
                  ))}

                  {/* Closed times */}
                  {closuresOnDay(closures, court.id, date).map((c) => {
                    const gridStart = DAY_START_MIN;
                    const gridEnd = DAY_START_MIN + totalSlots * 30;
                    const dayMs = date.getTime();
                    const from = Math.max((new Date(c.starts_at).getTime() - dayMs) / 60_000, gridStart);
                    const to = Math.min((new Date(c.ends_at).getTime() - dayMs) / 60_000, gridEnd);
                    if (to <= from) return null;
                    const topPx = ((from - gridStart) / 30) * SLOT_H;
                    const heightPx = ((to - from) / 30) * SLOT_H;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTooltip(null);
                          const rect = e.currentTarget.getBoundingClientRect();
                          const wrapRect = wrapRef.current?.getBoundingClientRect();
                          if (!wrapRect) return;
                          setClosureTip({
                            closure: c,
                            x: rect.left - wrapRect.left + rect.width / 2,
                            y: e.clientY - wrapRect.top,
                          });
                        }}
                        className="absolute inset-x-0 z-0 flex cursor-pointer flex-col items-center justify-start gap-1 overflow-hidden pt-3 text-center"
                        style={{ top: topPx, height: heightPx, ...CLOSED_BG }}
                        aria-label={`${tc("closed")}: ${tc(`reasons.${c.reason}`)}`}
                      >
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#3d4f35] shadow-sm">
                          <Ban size={11} aria-hidden="true" />
                          {tc(`reasons.${c.reason}`)}
                        </span>
                      </button>
                    );
                  })}

                  {/* Bookings */}
                  {courtBookings.map((b) => {
                    const isGroup = !!b.group_id;
                    const s = isGroup
                      ? GROUP_STYLE
                      : STATUS_STYLES[b.status] ?? STATUS_STYLES.confirmed;
                    const tc = isGroup
                      ? GROUP_TEXT
                      : STATUS_TEXT_COLORS[b.status] ??
                        STATUS_TEXT_COLORS.confirmed;
                    const startMin = timeToMinutes(new Date(b.starts_at));
                    const topPx =
                      ((startMin - DAY_START_MIN) / 30) * SLOT_H + 2;
                    const heightPx = (b.duration_min / 30) * SLOT_H - 4;
                    return (
                      <div
                        key={b.id}
                        onClick={(e) => handleBookingClick(e, b)}
                        className={`absolute left-1 right-1 rounded-lg px-2.5 py-2 cursor-pointer overflow-hidden z-1 border-l-4 ${s.wrapper}`}
                        style={{ top: topPx, height: heightPx }}
                      >
                        <div
                          className={`text-[13px] font-semibold truncate ${tc.name}`}
                        >
                          {getBookingName(b, tCommon("walkIn"))}
                        </div>
                        {b.coach && heightPx > 36 && (
                          <div className={`text-[11px] font-medium truncate ${tc.time}`}>
                            {isGroup
                              ? t("groupWith", { coach: b.coach.profile?.full_name ?? "" })
                              : t("lessonWith", { coach: b.coach.profile?.full_name ?? "" })}
                          </div>
                        )}
                        {heightPx > (b.coach ? 56 : 36) && (
                          <div className={`text-[11px] mt-[3px] ${tc.time}`}>
                            {format(new Date(b.starts_at), "HH:mm")} –{" "}
                            {format(new Date(b.ends_at), "HH:mm")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-10 bg-white border border-[0.5px] border-[#e8ede4] rounded-xl p-4 w-[220px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] -translate-y-full -mt-2"
          style={{
            left: Math.min(tooltip.x, wrapWidth - 220),
            top: tooltip.y - 8,
          }}
        >
          <div className="text-sm font-semibold text-[#111c0a] mb-2">
            {getBookingName(tooltip.booking, tCommon("walkIn"))}
          </div>
          <div className="text-xs text-[#3d4f35] flex flex-col gap-1">
            <span>{tooltip.booking.court?.name ?? "—"}</span>
            {tooltip.booking.coach && (
              <span>
                {t("lessonWith", {
                  coach: tooltip.booking.coach.profile?.full_name ?? "",
                })}
              </span>
            )}
            <span>
              {format(new Date(tooltip.booking.starts_at), "HH:mm")} –{" "}
              {format(new Date(tooltip.booking.ends_at), "HH:mm")} ·{" "}
              {tooltip.booking.duration_min} min
            </span>
            <span className="flex items-center gap-1.5 capitalize">
              <span
                className={`inline-block w-[7px] h-[7px] rounded-[2px] ${
                  (
                    STATUS_STYLES[tooltip.booking.status] ??
                    STATUS_STYLES.confirmed
                  ).dot
                }`}
              />
              {labels.bookingStatus(tooltip.booking.status)}
            </span>
            <span className="font-semibold text-[#111c0a]">
              €{tooltip.booking.total_price.toFixed(2)}
            </span>
          </div>
          <div className="text-[11px] text-[#6e7f65] mt-2 pt-2 border-t border-[0.5px] border-[#e8ede4]">
            Ref: {tooltip.booking.reference}
          </div>
        </div>
      )}

      {/* A closed time: what and why, and reopen */}
      {closureTip && (
        <div
          className="absolute z-10 w-[240px] -translate-y-full -mt-2 rounded-xl border border-[0.5px] border-[#e8ede4] bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
          style={{
            left: Math.min(Math.max(closureTip.x - 120, 0), wrapWidth - 240),
            top: closureTip.y - 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 text-sm font-semibold text-[#111c0a]">
            {tc("closed")} · {tc(`reasons.${closureTip.closure.reason}`)}
          </div>
          <div className="flex flex-col gap-1 text-xs text-[#3d4f35]">
            <span>{closureCourts(closureTip.closure)}</span>
            <span>{closureWhen(closureTip.closure)}</span>
            {closureTip.closure.note && <span className="italic">{closureTip.closure.note}</span>}
          </div>
          <button
            type="button"
            disabled={readOnly || reopening}
            title={hint ?? tc("reopenHint")}
            onClick={() =>
              startReopen(async () => {
                const r = await reopenCourts(closureTip.closure.id);
                if (r.error) {
                  setNotice(tc(`errors.${r.error}`));
                  return;
                }
                setClosureTip(null);
                setNotice(tc("reopened"));
                router.refresh();
              })
            }
            className="btn-secondary mt-3 w-full px-3 py-2 text-[13px]"
          >
            {reopening ? tc("reopening") : tc("reopen")}
          </button>
        </div>
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
