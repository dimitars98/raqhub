"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { addDays, format, setHours, setMinutes, startOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { dateLocale } from "@/lib/dateLocale";
import { createCoachBooking } from "@/app/actions/bookings";
import { startHoursFor } from "@/lib/openingHours";
import type { MyMembership, OpeningHours } from "@/types/database";
import type { BookingRules } from "@/lib/bookingRules";

type BusySlot = { starts_at: string; ends_at: string };


export default function CoachBookingForm({
  coachId,
  coachName,
  clubId,
  pricePerHour,
  hours,
  rules,
}: {
  coachId: string;
  coachName: string;
  clubId: string | null;
  pricePerHour: number;
  hours: OpeningHours;
  /** The coach's club's booking rules (lengths, days ahead, cancelling). */
  rules: BookingRules;
}) {
  const t = useTranslations("coachBooking");
  const locale = useLocale();
  const days = useMemo(
    () =>
      Array.from({ length: rules.max_days_ahead }, (_, i) => addDays(startOfDay(new Date()), i)),
    [rules.max_days_ahead],
  );

  const [day, setDay] = useState(days[0]);
  const [duration, setDuration] = useState(
    rules.durations.includes(60) ? 60 : rules.durations[0],
  );
  const [hour, setHour] = useState<number | null>(null);
  const [busy, setBusy] = useState<{ key: string; slots: BusySlot[] } | null>(null);
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Bumped to reload the taken times after a clash.
  const [refresh, setRefresh] = useState(0);

  const dayKey = format(day, "yyyy-MM-dd");

  // Taken times of this coach on the chosen day.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let slots: BusySlot[] = [];
      try {
        const { data, error: rpcError } = await createClient().rpc(
          "get_coach_busy_slots",
          { p_coach_id: coachId, p_day: dayKey },
        );
        if (rpcError) console.error("[get_coach_busy_slots]", rpcError);
        else slots = (data as BusySlot[]) ?? [];
      } catch (e) {
        console.error("[get_coach_busy_slots]", e);
      }
      // If loading fails every time stays open; the database still refuses clashes.
      if (!cancelled) setBusy({ key: dayKey, slots });
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId, dayKey, refresh]);

  // Member discount, only for a membership at the coach's club.
  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await createClient().rpc("my_memberships");
        if (cancelled) return;
        const membership = ((data ?? []) as unknown as MyMembership[]).find(
          (m) => m.club_id === clubId && m.status === "active",
        );
        setDiscount(membership?.plan?.discount_pct ?? 0);
      } catch {
        // No discount shown; the database still applies it when booking.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const startHours = startHoursFor(hours, day, duration);
  const ready = busy?.key === dayKey;

  const isTaken = (h: number) => {
    const start = setMinutes(setHours(day, h), 0);
    const end = new Date(start.getTime() + duration * 60_000);
    if (start < new Date()) return true;
    return (busy?.slots ?? []).some(
      (b) => start < new Date(b.ends_at) && end > new Date(b.starts_at),
    );
  };

  const base = (pricePerHour * duration) / 60;
  const total = Math.round(base * (1 - discount / 100) * 100) / 100;
  const selectedFree = hour !== null && ready && startHours.includes(hour) && !isTaken(hour);

  const pickDay = (d: Date) => {
    setDay(d);
    setHour(null);
    setError(null);
  };

  const submit = async () => {
    if (hour === null || !selectedFree) return;
    setSubmitting(true);
    setError(null);
    const startsAt = setMinutes(setHours(day, hour), 0);
    const result = await createCoachBooking({
      coach_id: coachId,
      starts_at: startsAt.toISOString(),
      duration_min: duration,
    });
    // Only reached when something went wrong; on success the redirect takes over.
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
      setHour(null);
      setRefresh((r) => r + 1);
    }
  };

  // date-fns, not Intl: not every browser has Macedonian or Albanian day names.
  const dfLocale = dateLocale(locale);

  return (
    <div className="card p-6">
      <h2 className="mb-5 text-lg font-semibold text-ink-900">{t("bookTitle")}</h2>

      {/* Day */}
      <p className="mb-2 text-xs font-medium text-ink-600">{t("date")}</p>
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => {
          const active = format(d, "yyyy-MM-dd") === dayKey;
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => pickDay(d)}
              aria-pressed={active}
              className={`flex min-w-[52px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-xs transition-colors ${
                active
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-200 text-ink-600 hover:border-brand-600"
              }`}
            >
              <span className="font-medium capitalize">{format(d, "EEE", { locale: dfLocale })}</span>
              <span className="mt-0.5 text-base font-semibold">{format(d, "d")}</span>
            </button>
          );
        })}
      </div>

      {/* Duration */}
      <p className="mb-2 text-xs font-medium text-ink-600">{t("duration")}</p>
      <div className="mb-5 flex gap-2">
        {rules.durations.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDuration(d);
              setHour(null);
            }}
            aria-pressed={duration === d}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              duration === d
                ? "border-brand-600 bg-brand-50 font-medium text-brand-900"
                : "border-ink-200 text-ink-600 hover:border-brand-600"
            }`}
          >
            {t("minutes", { n: d })}
          </button>
        ))}
      </div>

      {/* Start time */}
      <p className="mb-2 text-xs font-medium text-ink-600">{t("startTime")}</p>
      {!startHours.length ? (
        <p className="mb-5 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
          {t("closed")}
        </p>
      ) : !ready ? (
        <p className="mb-5 text-sm text-ink-400">{t("loading")}</p>
      ) : (
        <div className="mb-5 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {startHours.map((h) => {
            const taken = isTaken(h);
            const active = hour === h;
            return (
              <button
                key={h}
                type="button"
                disabled={taken}
                onClick={() => setHour(h)}
                aria-pressed={active}
                className={`rounded-lg border py-2 text-sm transition-colors ${
                  taken
                    ? "cursor-not-allowed border-ink-100 bg-ink-50 text-ink-200 line-through"
                    : active
                      ? "border-brand-600 bg-brand-600 font-medium text-white"
                      : "border-ink-200 text-ink-800 hover:border-brand-600"
                }`}
              >
                {String(h).padStart(2, "0")}:00
              </button>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50 px-4 py-3">
        <div className="text-sm text-ink-600">
          {t("minutes", { n: duration })} · {coachName}
          {discount > 0 && (
            <span className="badge-brand ml-2">{t("memberDiscount", { pct: discount })}</span>
          )}
        </div>
        <div className="text-base font-semibold text-ink-900">€{total.toFixed(2)}</div>
      </div>

      {rules.cancel_hours > 0 && (
        <p className="mb-3 text-xs text-ink-600">
          {t("cancelNote", { hours: rules.cancel_hours })}
        </p>
      )}

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!selectedFree || submitting}
        className="btn-primary btn-lg w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? t("booking") : selectedFree ? t("confirm") : t("selectTime")}
      </button>
    </div>
  );
}
