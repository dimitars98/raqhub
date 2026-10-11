"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addDays, format, setHours, setMinutes, startOfDay } from "date-fns";
import { useTranslations, useLocale } from "next-intl";

interface Props {
  courtId: string;
  pricePerHour: number;
  courtName: string;
  coachId?: string;
}

interface BusySlot {
  starts_at: string;
  ends_at: string;
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const DURATIONS = [60, 90, 120];

export default function BookingForm({
  courtId,
  pricePerHour,
  courtName,
  coachId,
}: Props) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Taken times for one court + day. `key` records which court/day they belong to.
  const [busy, setBusy] = useState<{ key: string; slots: BusySlot[] } | null>(
    null,
  );
  // Bumped to reload the taken times (e.g. after someone else grabs a slot).
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("booking");
  const locale = useLocale();

  const total = (pricePerHour * duration) / 60;
  const dayKey = format(selectedDay, "yyyy-MM-dd");
  const busyKey = `${courtId}|${dayKey}`;

  // Load the taken times whenever the court or the selected day changes.
  useEffect(() => {
    let cancelled = false;
    const key = `${courtId}|${dayKey}`;

    createClient()
      .rpc("get_busy_slots", { p_court_id: courtId, p_day: dayKey })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("[get_busy_slots]", error);
        // If loading fails, leave every slot open; the server still rejects clashes.
        setBusy({ key, slots: error ? [] : ((data as BusySlot[]) ?? []) });
      });

    return () => {
      cancelled = true;
    };
  }, [courtId, dayKey, refreshKey]);

  // True once the taken times shown belong to the currently selected court + day.
  const slotsReady = busy?.key === busyKey;

  const slotRange = (hour: number, dur: number) => {
    const start = setMinutes(setHours(selectedDay, hour), 0);
    const end = new Date(start.getTime() + dur * 60 * 1000);
    return { start, end };
  };

  // A slot can't be picked if it's still loading, already in the past,
  // or overlaps an existing booking for the chosen duration.
  const isUnavailable = (hour: number, dur: number) => {
    if (!slotsReady || !busy) return true;
    const { start, end } = slotRange(hour, dur);
    if (start < new Date()) return true;
    return busy.slots.some(
      (b) => start < new Date(b.ends_at) && end > new Date(b.starts_at),
    );
  };

  const selectedBlocked =
    selectedHour !== null && isUnavailable(selectedHour, duration);

  const handleBook = async () => {
    if (selectedHour === null || selectedBlocked) return;
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }

    const { start: startsAt, end: endsAt } = slotRange(selectedHour, duration);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        court_id: courtId,
        coach_id: coachId ?? null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        duration_min: duration,
        total_price: total,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? t("bookingFailed"));
      setLoading(false);
      // Someone else took the slot first: clear the pick and reload taken times.
      if (res.status === 409) {
        setSelectedHour(null);
        setRefreshKey((k) => k + 1);
      }
      return;
    }
    router.push(`/${locale}/dashboard?booked=1`);
  };

  return (
    <div className="card p-5">
      <h2 className="text-sm font-medium text-orange-900 mb-4">
        {t("bookThisCourt")}
      </h2>

      <div className="mb-4">
        <p className="text-xs text-orange-500 mb-2">{t("date")}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => (
            <button
              key={day.toISOString()}
              onClick={() => {
                setSelectedDay(day);
                setSelectedHour(null);
                setError(null);
              }}
              className={`flex-shrink-0 text-center px-3 py-2 rounded-xl border text-xs transition-colors ${
                format(day, "yyyy-MM-dd") === dayKey
                  ? "bg-orange-400 text-white border-orange-400"
                  : "border-orange-200 text-orange-700 hover:bg-orange-50"
              }`}
            >
              <div className="font-medium">{format(day, "EEE")}</div>
              <div className="mt-0.5 opacity-80">{format(day, "d")}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-orange-500 mb-2">{t("duration")}</p>
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => {
                setDuration(d);
                // A longer duration can run into the next booking; drop the pick if so.
                if (selectedHour !== null && isUnavailable(selectedHour, d))
                  setSelectedHour(null);
              }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                duration === d
                  ? "bg-orange-400 text-white border-orange-400"
                  : "border-orange-200 text-orange-700 hover:bg-orange-50"
              }`}
            >
              {d} {t("min")}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <p className="text-xs text-orange-500 mb-2">{t("time")}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {HOURS.map((h) => {
            const unavailable = isUnavailable(h, duration);
            return (
              <button
                key={h}
                onClick={() => setSelectedHour(h)}
                disabled={unavailable}
                className={`text-xs py-2 rounded-lg border text-center transition-colors ${
                  unavailable
                    ? "border-orange-100 bg-orange-50/50 text-orange-300 line-through cursor-not-allowed"
                    : selectedHour === h
                      ? "bg-orange-400 text-white border-orange-400"
                      : "border-orange-200 text-orange-700 hover:bg-orange-50"
                }`}
              >
                {String(h).padStart(2, "0")}:00
              </button>
            );
          })}
        </div>
      </div>

      {selectedHour !== null && (
        <div className="border-t border-orange-100 pt-4 mb-4 space-y-2 text-sm">
          <div className="flex justify-between text-orange-600">
            <span>{courtName}</span>
            <span>{format(selectedDay, "EEE d MMM")}</span>
          </div>
          <div className="flex justify-between text-orange-600">
            <span>
              {String(selectedHour).padStart(2, "0")}:00 · {duration} {t("min")}
            </span>
            <span className="font-medium text-orange-900">
              €{total.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <button
        onClick={handleBook}
        disabled={selectedHour === null || selectedBlocked || loading}
        className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading
          ? t("booking")
          : selectedHour === null
            ? t("selectSlot")
            : t("confirmBooking")}
      </button>
    </div>
  );
}
