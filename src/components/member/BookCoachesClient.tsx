"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { format, addDays, startOfDay, setHours, setMinutes } from "date-fns";
import { useRouter } from "next/navigation";
import type { Coach } from "@/types/database";
import Modal from "@/components/ui/Modal";

type CoachWithProfile = Coach & {
  profile?: { full_name: string | null } | null;
  club?: { name: string; city: string | null } | null;
};

type FormValues = {
  date: string;
  hour: number;
  duration: number;
};

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const DURATIONS = [60, 90, 120];

const colors = [
  "bg-orange-100 text-orange-800",
  "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800",
  "bg-blue-100 text-blue-800",
];

const initials = (name: string | null) =>
  (name ?? "C")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function BookCoachesClient({
  coaches,
}: {
  coaches: CoachWithProfile[];
}) {
  const [selected, setSelected] = useState<CoachWithProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
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
  const total = selected ? (selected.price_per_hour * watchedDuration) / 60 : 0;

  const onSubmit = async (values: FormValues) => {
    if (!selected) return;
    setError(null);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coach_id: selected.id,
        starts_at: setMinutes(
          setHours(new Date(values.date), values.hour),
          0,
        ).toISOString(),
        ends_at: new Date(
          setMinutes(
            setHours(new Date(values.date), values.hour),
            0,
          ).getTime() +
            values.duration * 60000,
        ).toISOString(),
        duration_min: values.duration,
        total_price: total,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Booking failed");
      return;
    }
    router.push("/my-bookings?booked=1");
  };

  return (
    <div>
      <h1 className="text-2xl font-medium text-orange-900 mb-1">
        Book a coach
      </h1>
      <p className="text-sm text-orange-500 mb-8">
        {coaches.length} coaches available
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {coaches.map((coach, i) => (
          <div key={coach.id} className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${colors[i % colors.length]}`}
              >
                {initials(coach.profile?.full_name ?? null)}
              </div>
              <div>
                <div className="text-sm font-medium text-orange-900">
                  {coach.profile?.full_name ?? "Coach"}
                </div>
                <div className="text-xs text-orange-400 mt-0.5">
                  {coach.club?.name ?? "Independent"}
                  {coach.club?.city ? ` · ${coach.club.city}` : ""}
                </div>
              </div>
            </div>
            {coach.bio && (
              <p className="text-xs text-orange-600 mb-3 line-clamp-2">
                {coach.bio}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {coach.levels.map((l) => (
                <span
                  key={l}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 capitalize"
                >
                  {l}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-orange-800">
                €{coach.price_per_hour}/hr
              </span>
              <button
                onClick={() => setSelected(coach)}
                className="btn-primary text-xs py-1.5 px-4"
              >
                Book
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setError(null);
        }}
      >
        <Modal.Content>
          <Modal.Header>
            Book {selected?.profile?.full_name ?? "coach"}
          </Modal.Header>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Modal.Body>
              <div className="text-xs text-orange-400 mb-4">
                {selected?.levels.join(" · ")} · €{selected?.price_per_hour}/hr
              </div>

              <Modal.Field label="Date">
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {days.map((day) => {
                        const val = format(day, "yyyy-MM-dd");
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => field.onChange(val)}
                            className={`flex-shrink-0 text-center px-3 py-2 rounded-xl border text-xs transition-colors ${
                              field.value === val
                                ? "bg-orange-400 text-white border-orange-400"
                                : "border-orange-200 text-orange-700 hover:bg-orange-50"
                            }`}
                          >
                            <div className="font-medium">
                              {format(day, "EEE")}
                            </div>
                            <div className="opacity-80">{format(day, "d")}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              </Modal.Field>

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

              {selected && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-orange-600">
                    {watchedDuration} min · {selected.profile?.full_name}
                  </span>
                  <span className="text-sm font-medium text-orange-900">
                    €{total.toFixed(2)}
                  </span>
                </div>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}
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
                {isSubmitting ? "Booking…" : `Confirm · €${total.toFixed(2)}`}
              </button>
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal>
    </div>
  );
}
