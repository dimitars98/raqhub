"use client";

import { dateLocale } from "@/lib/dateLocale";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  format,
  addDays,
  startOfDay,
  setHours,
  setMinutes,
  isToday,
} from "date-fns";
import type { Court, Sport } from "@/types/database";
import { useBusySlots, useMemberDiscount, useRefreshBusy } from "@/hooks/useBookingData";
import CourtArt from "@/components/courts/CourtArt";
import { courtColor } from "@/lib/courtColors";
import Modal from "@/components/ui/Modal";
import { ArrowRight, CalendarDays, Clock, MapPin, Search } from "lucide-react";
import { createBooking } from "@/app/actions/bookings";
import { normalizeHours, startHoursFor } from "@/lib/openingHours";
import { normalizeRules } from "@/lib/bookingRules";
import { Link } from "@/i18n/navigation";
import { useLabels } from "@/hooks/useLabels";
import { payModeOf } from "@/lib/paymentMode";

export type CourtWithClub = Court & {
  club?: {
    name: string;
    city: string | null;
    slug?: string;
    opening_hours?: unknown;
    booking_rules?: unknown;
    payment_mode?: string | null;
    stripe_charges_enabled?: boolean | null;
  } | null;
};

type FormValues = {
  date: string;
  hour: number;
  duration: number;
};


const money = (n: number) => `€${n.toFixed(2).replace(/\.00$/, "")}`;
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export default function BookCourtsClient({
  courts,
  clubName,
  paymentCancelled,
  openCourtId,
}: {
  courts: CourtWithClub[];
  /** Set when the list is filtered to one club (from its public page). */
  clubName?: string;
  /** A court picked on the club's page: its booking window opens straight away. */
  openCourtId?: string;
  /** Back from Stripe without paying. */
  paymentCancelled?: boolean;
}) {
  const t = useTranslations("bookCourts");
  const dfLocale = dateLocale(useLocale());
  const labels = useLabels();
  const tCoach = useTranslations("coachBooking");
  const tPay = useTranslations("payments");
  const [selected, setSelected] = useState<CourtWithClub | null>(
    () => courts.find((c) => c.id === openCourtId) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [sport, setSport] = useState<Sport | "all">("all");
  const [query, setQuery] = useState("");

  // The selected court's club decides lengths, how far ahead, and cancelling.
  const rules = normalizeRules(selected?.club?.booking_rules);
  const days = Array.from({ length: rules.max_days_ahead }, (_, i) =>
    addDays(startOfDay(new Date()), i),
  );

  const {
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      hour: 9,
      duration: 60,
    },
  });

  const watchedDuration = watch("duration");
  const watchedDate = watch("date");
  const watchedHour = watch("hour");

  // Start times that fit inside the selected club's opening hours that day.
  const hourOptions = selected
    ? startHoursFor(
        normalizeHours(selected.club?.opening_hours),
        new Date(`${watchedDate}T00:00`),
        watchedDuration,
      )
    : [];
  const isClosed = !!selected && hourOptions.length === 0;

  // The taken (and closed) times for the selected court and day.
  const { slots: busySlots, ready: slotsReady } = useBusySlots(selected?.id, watchedDate);
  const refreshBusy = useRefreshBusy();
  const discount = useMemberDiscount(selected?.club_id);

  /** Can this start time be booked for the chosen length? */
  const free = (hour: number) => {
    const start = setMinutes(
      setHours(new Date(`${watchedDate}T00:00`), hour),
      0,
    );
    const end = new Date(start.getTime() + watchedDuration * 60_000);
    if (start < new Date()) return false;
    if (!slotsReady) return true;
    return !busySlots.some(
      (b) => start < new Date(b.ends_at) && end > new Date(b.starts_at),
    );
  };
  const freeHours = hourOptions.filter(free);
  const noTimes =
    !!selected && !isClosed && slotsReady && freeHours.length === 0;

  // Keep the picked length and day allowed by the selected club's rules.
  const lastDay = format(days[days.length - 1], "yyyy-MM-dd");
  useEffect(() => {
    if (!rules.durations.includes(watchedDuration)) {
      setValue("duration", rules.durations[0]);
    }
    if (watchedDate > lastDay)
      setValue("date", format(new Date(), "yyyy-MM-dd"));
  }, [rules.durations, watchedDuration, watchedDate, lastDay, setValue]);

  // Keep the picked hour on a free time when the day, length or court changes.
  useEffect(() => {
    if (freeHours.length && !freeHours.includes(watchedHour)) {
      setValue("hour", freeHours[0]);
    }
  }, [freeHours, watchedHour, setValue]);

  const baseTotal = selected
    ? (selected.price_per_hour * watchedDuration) / 60
    : 0;
  const finalTotal = baseTotal * (1 - discount / 100);
  // How this court's club takes payment (20261029_online_payments.sql).
  const payMode = payModeOf(selected?.club);
  const [payOnline, setPayOnline] = useState(true);
  const paysNow = finalTotal > 0 && (payMode === "online" || (payMode === "either" && payOnline));


  const onSubmit = async (values: FormValues) => {
    if (!selected || !free(values.hour)) return;
    setError(null);
    // "T00:00" makes this the player's local midnight.
    const startsAt = setMinutes(
      setHours(new Date(`${values.date}T00:00`), values.hour),
      0,
    );
    const result = await createBooking({
      court_id: selected.id,
      starts_at: startsAt.toISOString(),
      duration_min: values.duration,
      payOnline: paysNow,
    });
    // The club takes payment online: on to Stripe's payment page.
    if (result?.checkoutUrl) {
      window.location.assign(result.checkoutUrl);
      return;
    }
    // Only reached when something went wrong; on success the redirect takes over.
    if (result?.error) {
      setError(result.error);
      // Someone may have just taken it: load the taken times again.
      refreshBusy();
    }
  };

  // Filters: sport (when there's more than one) and a search over court, club and city.
  const sports = [...new Set(courts.map((c) => c.sport))];
  const q = query.trim().toLowerCase();
  const shown = courts.filter(
    (c) =>
      (sport === "all" || c.sport === sport) &&
      (!q ||
        [c.name, c.club?.name, c.club?.city].some((v) =>
          v?.toLowerCase().includes(q),
        )),
  );
  // Grouped by club, in the order the clubs first appear (cheapest court first).
  const groups = shown.reduce<
    { key: string; club: CourtWithClub["club"]; courts: CourtWithClub[] }[]
  >((acc, c) => {
    const key = c.club_id ?? "none";
    const g = acc.find((x) => x.key === key);
    if (g) g.courts.push(c);
    else acc.push({ key, club: c.club, courts: [c] });
    return acc;
  }, []);
  const oneClub = !!clubName || new Set(courts.map((c) => c.club_id)).size <= 1;

  const pill = (on: boolean) =>
    `h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium transition-colors ${
      on
        ? "border-ink-900 bg-ink-900 text-white"
        : "border-ink-200 bg-white text-ink-600 hover:border-ink-400 hover:text-ink-900"
    }`;

  const endHour = (h: number) => {
    const end = new Date(
      setMinutes(setHours(new Date(`${watchedDate}T00:00`), h), 0).getTime() +
        watchedDuration * 60_000,
    );
    return format(end, "HH:mm");
  };

  return (
    <div className="mx-auto max-w-[1040px]">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-ink-900">
            {clubName ? t("titleAtClub", { club: clubName }) : t("title")}
          </h1>
          {paymentCancelled && (
            <p role="status" className="mb-3 rounded-lg bg-[#fdf5df] px-3 py-2 text-sm text-[#5c4000]">
              {tPay("book.cancelled")}
            </p>
          )}
          <p className="mt-1 text-sm text-ink-600">
            {t("available", { n: courts.length })}
            {clubName && (
              <>
                {" · "}
                <Link
                  href="/book"
                  className="font-medium text-ink-900 underline-offset-2 hover:underline"
                >
                  {t("showAll")}
                </Link>
              </>
            )}
          </p>
        </div>
        {courts.length > 3 && (
          <label className="relative w-full sm:w-64">
            <span className="sr-only">{t("search")}</span>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="input h-10 rounded-full pl-10"
            />
          </label>
        )}
      </div>

      {sports.length > 1 && (
        <div
          className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label={t("sport")}
        >
          <button
            type="button"
            aria-pressed={sport === "all"}
            onClick={() => setSport("all")}
            className={pill(sport === "all")}
          >
            {t("allSports")}
          </button>
          {sports.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sport === s}
              onClick={() => setSport(s)}
              className={pill(sport === s)}
            >
              {labels.sport(s)}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center text-sm text-ink-600">
          {courts.length === 0 ? t("empty") : t("noMatch")}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.club?.name ?? undefined}>
              {!oneClub && g.club && (
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-ink-900">
                    {g.club.name}
                    {g.club.city && (
                      <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-ink-600">
                        <MapPin size={13} aria-hidden="true" />
                        {g.club.city}
                      </span>
                    )}
                  </h2>
                  {g.club.slug && (
                    <Link
                      href={`/clubs/${g.club.slug}`}
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-600 hover:text-ink-900"
                    >
                      {t("clubPage")}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              )}
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.courts.map((court) => (
                  <li key={court.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(court);
                        setError(null);
                      }}
                      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white text-left transition-all hover:-translate-y-0.5 hover:border-ink-200 hover:shadow-[0_12px_28px_-14px_rgba(17,28,10,0.35)] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                    >
                      <div className="relative h-24 w-full overflow-hidden">
                        <CourtArt court={court} />
                        <span className="absolute top-2.5 left-2.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                          {labels.sport(court.sport)}
                        </span>
                        <span className="absolute top-2.5 right-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink-900">
                          {labels.inOut(court.is_indoor)}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-ink-900">
                            {court.name}
                          </p>
                          <p className="truncate text-[13px] text-ink-600">
                            {labels.surface(court.surface)} · {labels.courtColor(courtColor(court))}
                          </p>
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-3">
                          <p className="text-ink-900">
                            <span className="text-lg font-extrabold">
                              {money(court.price_per_hour)}
                            </span>
                            <span className="text-[13px] text-ink-600">
                              {" "}
                              {t("perHour")}
                            </span>
                          </p>
                          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink-900 px-4 text-[13px] font-semibold text-white transition-colors group-hover:bg-brand-600">
                            {t("book")}
                            <ArrowRight
                              size={14}
                              aria-hidden="true"
                              className="transition-transform group-hover:translate-x-0.5"
                            />
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Booking */}
      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setError(null);
        }}
      >
        <Modal.Content className="max-w-lg p-0!">
          {selected && (
            <div className="relative h-20 w-full shrink-0 overflow-hidden">
              <CourtArt court={selected} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              <div className="absolute bottom-2.5 left-5 text-white">
                <p className="text-base font-bold leading-tight">
                  {selected.name}
                </p>
                <p className="text-xs text-white/85">
                  {[
                    selected.club?.name,
                    selected.club?.city,
                    labels.surface(selected.surface),
                    labels.courtColor(courtColor(selected)),
                    labels.inOut(selected.is_indoor),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={t("cancel")}
                className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/50"
              >
                ×
              </button>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col p-5 sm:p-6"
          >
            <Modal.Body>
              {/* Day */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-600">
                  <CalendarDays size={13} aria-hidden="true" />
                  {t("date")}
                </p>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                      {days.map((day) => {
                        const val = format(day, "yyyy-MM-dd");
                        const on = field.value === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            aria-pressed={on}
                            onClick={() => field.onChange(val)}
                            className={`flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 transition-colors ${
                              on
                                ? "border-ink-900 bg-ink-900 text-white"
                                : "border-ink-100 bg-white text-ink-900 hover:border-ink-300"
                            }`}
                          >
                            <span
                              className={`text-[11px] font-medium uppercase ${on ? "text-white/70" : "text-ink-400"}`}
                            >
                              {isToday(day)
                                ? t("today")
                                : format(day, "EEE", { locale: dfLocale })}
                            </span>
                            <span className="text-lg leading-tight font-bold">
                              {format(day, "d")}
                            </span>
                            <span
                              className={`text-[10px] ${on ? "text-white/70" : "text-ink-400"}`}
                            >
                              {format(day, "MMM", { locale: dfLocale })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              </div>

              {/* Length */}
              {rules.durations.length > 1 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-600">
                    <Clock size={13} aria-hidden="true" />
                    {t("duration")}
                  </p>
                  <Controller
                    name="duration"
                    control={control}
                    render={({ field }) => (
                      <div
                        role="radiogroup"
                        aria-label={t("duration")}
                        className="flex gap-1 rounded-xl bg-ink-50 p-1"
                      >
                        {rules.durations.map((d) => (
                          <button
                            key={d}
                            type="button"
                            role="radio"
                            aria-checked={field.value === d}
                            onClick={() => field.onChange(d)}
                            className={`h-9 flex-1 rounded-lg text-[13px] font-medium transition-colors ${
                              field.value === d
                                ? "bg-white text-ink-900 shadow-sm"
                                : "text-ink-600 hover:text-ink-900"
                            }`}
                          >
                            {t("minutes", { n: d })}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </div>
              )}

              {/* Start time */}
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-600">
                  {t("startTime")}
                </p>
                {isClosed ? (
                  <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
                    {t("closedDay")}
                  </p>
                ) : noTimes ? (
                  <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
                    {t("noTimes")}
                  </p>
                ) : (
                  <Controller
                    name="hour"
                    control={control}
                    render={({ field }) => (
                      <div
                        role="radiogroup"
                        aria-label={t("startTime")}
                        aria-busy={!slotsReady}
                        className={`grid grid-cols-4 gap-2 sm:grid-cols-5 ${slotsReady ? "" : "animate-pulse"}`}
                      >
                        {hourOptions.map((h) => {
                          const ok = free(h);
                          const on = ok && field.value === h;
                          return (
                            <button
                              key={h}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              disabled={!ok || !slotsReady}
                              onClick={() => field.onChange(h)}
                              className={`h-10 rounded-lg border text-[13px] font-semibold tabular-nums transition-colors ${
                                on
                                  ? "border-brand-600 bg-brand-600 text-white"
                                  : ok
                                    ? "border-ink-100 bg-white text-ink-900 hover:border-brand-400 hover:bg-brand-50"
                                    : "cursor-not-allowed border-transparent bg-ink-50 text-ink-400 line-through"
                              }`}
                            >
                              {hh(h)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                )}
              </div>

              {/* Summary */}
              {selected && !isClosed && !noTimes && (
                <div className="rounded-xl border border-ink-100 bg-[#f8f9f7] px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-600">
                      {format(new Date(`${watchedDate}T00:00`), "EEE d MMM", {
                        locale: dfLocale,
                      })}
                      {freeHours.includes(watchedHour) &&
                        `, ${hh(watchedHour)}–${endHour(watchedHour)}`}
                    </span>
                    <span className="flex items-baseline gap-2">
                      {discount > 0 && (
                        <span className="text-[13px] text-ink-400 line-through">
                          {money(baseTotal)}
                        </span>
                      )}
                      <span className="text-base font-extrabold text-ink-900">
                        {money(finalTotal)}
                      </span>
                    </span>
                  </div>
                  {discount > 0 && (
                    <p className="mt-1 text-xs font-medium text-brand-800">
                      {t("memberDiscount", { pct: discount })}
                    </p>
                  )}
                  {payMode === "either" && finalTotal > 0 ? (
                    <div role="radiogroup" aria-label={tPay("book.how")} className="mt-3 grid grid-cols-2 gap-2">
                      {[true, false].map((online) => (
                        <button
                          key={String(online)}
                          type="button"
                          role="radio"
                          aria-checked={payOnline === online}
                          onClick={() => setPayOnline(online)}
                          className={`rounded-lg border px-3 py-2 text-left text-[13px] ${
                            payOnline === online
                              ? "border-ink-900 bg-white font-semibold text-ink-900"
                              : "border-ink-100 text-ink-600"
                          }`}
                        >
                          {online ? tPay("book.payNow") : tPay("book.payAtClub")}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-400">
                    {paysNow ? tPay("book.onlineNote", { min: 30 }) : t("payAtClub")}
                  </p>
                </div>
              )}

              {selected && rules.cancel_hours > 0 && (
                <p className="text-xs text-ink-600">
                  {tCoach("cancelNote", { hours: rules.cancel_hours })}
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
            </Modal.Body>

            <Modal.Footer>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="btn-secondary flex-1"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isClosed ||
                  noTimes ||
                  !slotsReady ||
                  !freeHours.includes(watchedHour)
                }
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {isSubmitting
                  ? t("booking")
                  : paysNow
                    ? tPay("book.payButton", { price: finalTotal.toFixed(2) })
                    : t("confirm", { price: finalTotal.toFixed(2) })}
              </button>
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal>
    </div>
  );
}
