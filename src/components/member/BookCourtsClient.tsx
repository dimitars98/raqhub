"use client";

import { dateLocale } from "@/lib/dateLocale";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { format, addDays, startOfDay, setHours, setMinutes } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Court, MyMembership } from "@/types/database";
import Modal from "@/components/ui/Modal";
import { MapPin } from "lucide-react";
import { createBooking } from "@/app/actions/bookings";
import { normalizeHours, startHoursFor } from "@/lib/openingHours";
import { normalizeRules } from "@/lib/bookingRules";
import { Link } from "@/i18n/navigation";
import { useLabels } from "@/hooks/useLabels";
import { surfaceTone } from "@/lib/badges";
import SelectField from "@/components/ui/SelectField";

export type CourtWithClub = Court & {
  club?: {
    name: string;
    city: string | null;
    slug?: string;
    opening_hours?: unknown;
    booking_rules?: unknown;
  } | null;
};

type FormValues = {
  date: string;
  hour: number;
  duration: number;
};

export default function BookCourtsClient({
  courts,
  clubName,
}: {
  courts: CourtWithClub[];
  /** Set when the list is filtered to one club (from its public page). */
  clubName?: string;
}) {
  const t = useTranslations("bookCourts");
  const dfLocale = dateLocale(useLocale());
  const labels = useLabels();
  const tCoach = useTranslations("coachBooking");
  const [selected, setSelected] = useState<CourtWithClub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const supabase = createClient();
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

  // Keep the picked length and day allowed by the selected club's rules.
  const lastDay = format(days[days.length - 1], "yyyy-MM-dd");
  useEffect(() => {
    if (!rules.durations.includes(watchedDuration)) {
      setValue("duration", rules.durations[0]);
    }
    if (watchedDate > lastDay) setValue("date", format(new Date(), "yyyy-MM-dd"));
  }, [rules.durations, watchedDuration, watchedDate, lastDay, setValue]);

  // Keep the picked hour valid when the day, duration or court changes.
  useEffect(() => {
    if (hourOptions.length && !hourOptions.includes(watchedHour)) {
      setValue("hour", hourOptions[0]);
    }
  }, [hourOptions, watchedHour, setValue]);
  const baseTotal = selected
    ? (selected.price_per_hour * watchedDuration) / 60
    : 0;
  const finalTotal = baseTotal * (1 - discount / 100);

  // Fetch member discount when modal opens
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      // Only a membership at this court's club gives a discount.
      const { data } = await supabase.rpc("my_memberships");
      if (cancelled) return;
      const membership = ((data ?? []) as unknown as MyMembership[]).find(
        (m) => m.club_id === selected.club_id && m.status === "active",
      );
      setDiscount(membership?.plan?.discount_pct ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, supabase]);

  const onSubmit = async (values: FormValues) => {
    if (!selected) return;
    setError(null);

    // "T00:00" makes this the customer's local midnight (see note below)
    const startsAt = setMinutes(
      setHours(new Date(`${values.date}T00:00`), values.hour),
      0,
    );

    const result = await createBooking({
      court_id: selected.id,
      starts_at: startsAt.toISOString(),
      duration_min: values.duration,
    });
    // Only reached when something went wrong; on success the redirect takes over.
    if (result?.error) setError(result.error);
  };

  return (
    <div className="max-w-[800px] mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-medium text-brand-900 mb-1">
          {clubName ? t("titleAtClub", { club: clubName }) : t("title")}
        </h1>
        <p className="text-sm text-brand-400">
          {t("available", { n: courts.length })}
          {clubName && (
            <>
              {" · "}
              <Link href="/book" className="underline hover:text-brand-600">
                {t("showAll")}
              </Link>
            </>
          )}
        </p>
      </div>

      {/* Court list */}
      <div className="flex flex-col gap-3">
        {courts.map((court) => (
          <div
            key={court.id}
            className="card px-5 py-4 flex items-center gap-4 hover:border-brand-300 transition-colors"
          >
            {/* Availability dot */}
            <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0" />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-brand-900">
                  {court.name}
                </span>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    surfaceTone(court.surface)
                  }`}
                >
                  {labels.surface(court.surface)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-brand-400">
                {court.club?.city && (
                  <>
                    <MapPin size={11} />
                    <span>{court.club.city}</span>
                    <span>·</span>
                  </>
                )}
                <span>{court.club?.name}</span>
                <span>·</span>
                <span>{labels.inOut(court.is_indoor)}</span>
              </div>
            </div>

            {/* Price + CTA */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-medium text-brand-800">
                €{court.price_per_hour}/hr
              </span>
              <button
                onClick={() => {
                  setSelected(court);
                  setDiscount(0);
                  setError(null);
                }}
                className="btn-primary text-xs py-1.5 px-4"
              >
                {t("book")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Booking modal */}
      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setError(null);
        }}
      >
        <Modal.Content>
          <Modal.Header>{selected?.name ?? t("bookCourt")}</Modal.Header>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Modal.Body>
              {/* Court meta */}
              <div className="flex items-center gap-2 mb-5">
                {selected && (
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      surfaceTone(selected.surface)
                    }`}
                  >
                    {labels.surface(selected.surface)}
                  </span>
                )}
                <span className="text-xs text-brand-400">
                  {selected?.club?.name}
                  {selected?.club?.city ? ` · ${selected.club.city}` : ""}
                </span>
                <span className="text-xs text-brand-400">·</span>
                <span className="text-xs text-brand-400">
                  {labels.inOut(selected?.is_indoor)}
                </span>
              </div>

              {/* Date picker */}
              <Modal.Field label={t("date")}>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {days.map((day) => {
                        const val = format(day, "yyyy-MM-dd");
                        const isSelected = field.value === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => field.onChange(val)}
                            className={`flex-shrink-0 text-center px-3 py-2 rounded-xl border text-xs transition-colors ${
                              isSelected
                                ? "bg-brand-600 text-white border-brand-600"
                                : "border-brand-200 text-brand-700 hover:bg-brand-50 hover:border-brand-300"
                            }`}
                          >
                            <div className="font-medium">
                              {format(day, "EEE", { locale: dfLocale })}
                            </div>
                            <div
                              className={
                                isSelected ? "opacity-80" : "opacity-60"
                              }
                            >
                              {format(day, "d")}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              </Modal.Field>

              {/* Time + duration */}
              <Modal.Grid>
                <Modal.Field label={t("startTime")}>
                  <Controller
                    name="hour"
                    control={control}
                    render={({ field }) => (
                      <SelectField
                        ariaLabel={t("startTime")}
                        disabled={isClosed}
                        value={isClosed ? "closed" : String(field.value)}
                        onChange={(v) => field.onChange(Number(v))}
                        options={
                          isClosed
                            ? [{ value: "closed", label: t("closed") }]
                            : hourOptions.map((h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }))
                        }
                      />
                    )}
                  />
                </Modal.Field>
                <Modal.Field label={t("duration")}>
                  <Controller
                    name="duration"
                    control={control}
                    render={({ field }) => (
                      <SelectField
                        ariaLabel={t("duration")}
                        value={String(field.value)}
                        onChange={(v) => field.onChange(Number(v))}
                        options={rules.durations.map((d) => ({ value: String(d), label: t("minutes", { n: d }) }))}
                      />
                    )}
                  />
                </Modal.Field>
              </Modal.Grid>

              {/* Price summary */}
              {selected && (
                <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-brand-600">
                      {t("minutes", { n: watchedDuration })} · {selected.name}
                    </span>
                    <span
                      className={
                        discount > 0
                          ? "text-sm line-through text-brand-400"
                          : "text-sm font-medium text-brand-900"
                      }
                    >
                      €{baseTotal.toFixed(2)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-brand-100">
                      <span className="text-xs text-brand-600 font-medium">
                        {t("memberDiscount", { pct: discount })}
                      </span>
                      <span className="text-sm font-medium text-brand-900">
                        €{finalTotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {selected && rules.cancel_hours > 0 && (
                <p className="text-xs text-brand-600 mt-1">
                  {tCoach("cancelNote", { hours: rules.cancel_hours })}
                </p>
              )}
              {isClosed && (
                <p className="text-xs text-brand-600 mt-1">
                  {t("closedDay")}
                </p>
              )}
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
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
                disabled={isSubmitting || isClosed}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {isSubmitting
                  ? t("booking")
                  : t("confirm", { price: finalTotal.toFixed(2) })}
              </button>
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal>
    </div>
  );
}
