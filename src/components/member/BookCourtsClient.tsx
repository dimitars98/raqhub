"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { format, addDays, startOfDay, setHours, setMinutes } from "date-fns";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Court } from "@/types/database";
import Modal from "@/components/ui/Modal";
import { MapPin, Wifi, WifiOff } from "lucide-react";
import { createBooking } from "@/app/actions/bookings";

type CourtWithClub = Court & {
  club?: { name: string; city: string | null } | null;
};

type FormValues = {
  date: string;
  hour: number;
  duration: number;
};

const SURFACE_LABEL: Record<string, string> = {
  clay: "Clay",
  hard: "Hard",
  grass: "Grass",
  artificial_grass: "Artificial grass",
  carpet: "Carpet",
};

const SURFACE_COLOR: Record<string, string> = {
  clay: "bg-amber-100 text-amber-800",
  hard: "bg-court-100 text-court-800",
  grass: "bg-brand-100 text-brand-800",
  artificial_grass: "bg-brand-50 text-brand-700",
  carpet: "bg-stone-100 text-stone-700",
};

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const DURATIONS = [60, 90, 120];

export default function BookCourtsClient({
  courts,
}: {
  courts: CourtWithClub[];
}) {
  const [selected, setSelected] = useState<CourtWithClub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const router = useRouter();
  const supabase = createClient();
  const days = Array.from({ length: 14 }, (_, i) =>
    addDays(startOfDay(new Date()), i),
  );

  const {
    register,
    handleSubmit,
    watch,
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
  const baseTotal = selected
    ? (selected.price_per_hour * watchedDuration) / 60
    : 0;
  const finalTotal = baseTotal * (1 - discount / 100);

  // Fetch member discount when modal opens
  useEffect(() => {
    if (!selected) return;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data } = (await supabase
        .from("members")
        .select("plan:membership_plans(discount_pct)")
        .eq("email", user.email)
        .eq("status", "active")
        .maybeSingle()) as {
        data: { plan: { discount_pct: number } | null } | null;
      };
      setDiscount(data?.plan?.discount_pct ?? 0);
    })();
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
          Book a court
        </h1>
        <p className="text-sm text-brand-400">
          {courts.length} court{courts.length !== 1 ? "s" : ""} available
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
                    SURFACE_COLOR[court.surface] ?? "bg-brand-50 text-brand-600"
                  }`}
                >
                  {SURFACE_LABEL[court.surface]}
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
                <span>{court.is_indoor ? "Indoor" : "Outdoor"}</span>
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
                Book
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
          <Modal.Header>{selected?.name ?? "Book court"}</Modal.Header>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Modal.Body>
              {/* Court meta */}
              <div className="flex items-center gap-2 mb-5">
                {selected && (
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      SURFACE_COLOR[selected.surface] ??
                      "bg-brand-50 text-brand-600"
                    }`}
                  >
                    {SURFACE_LABEL[selected.surface]}
                  </span>
                )}
                <span className="text-xs text-brand-400">
                  {selected?.club?.name}
                  {selected?.club?.city ? ` · ${selected.club.city}` : ""}
                </span>
                <span className="text-xs text-brand-400">·</span>
                <span className="text-xs text-brand-400">
                  {selected?.is_indoor ? "Indoor" : "Outdoor"}
                </span>
              </div>

              {/* Date picker */}
              <Modal.Field label="Date">
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
                              {format(day, "EEE")}
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
                <Modal.Field label="Start time">
                  <select
                    className="input"
                    {...register("hour", { valueAsNumber: true })}
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </Modal.Field>
                <Modal.Field label="Duration">
                  <select
                    className="input"
                    {...register("duration", { valueAsNumber: true })}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                </Modal.Field>
              </Modal.Grid>

              {/* Price summary */}
              {selected && (
                <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-brand-600">
                      {watchedDuration} min · {selected.name}
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
                        Member discount {discount}%
                      </span>
                      <span className="text-sm font-medium text-brand-900">
                        €{finalTotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </Modal.Body>

            <Modal.Footer>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {isSubmitting
                  ? "Booking…"
                  : `Confirm · €${finalTotal.toFixed(2)}`}
              </button>
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal>
    </div>
  );
}
