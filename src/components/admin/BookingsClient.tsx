"use client";

import { dateLocale } from "@/lib/dateLocale";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { format, addDays, startOfDay, setHours, setMinutes } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useTranslations, useLocale } from "next-intl";
import type {
  Booking,
  BookingStatus,
  Court,
  Profile,
  Member,
} from "@/types/database";
import Modal from "@/components/ui/Modal";
import { noShowCutoff } from "@/lib/bookingRules";
import { BOOKING_STATUSES } from "@/lib/labels";
import { useLabels } from "@/hooks/useLabels";
import { BADGE, bookingStatusTone } from "@/lib/badges";
import { DAY_HOURS } from "@/lib/openingHours";

export type BookingWithJoins = Booking & {
  court?: Pick<Court, "name"> | null;
  member?: Pick<Member, "full_name"> | null;
  player?: (Pick<Profile, "full_name"> & { email?: string | null }) | null;
  coach?: { profile?: Pick<Profile, "full_name"> | null } | null;
};

type FormValues = {
  court_id: string;
  player_type: "member" | "walkin";
  member_id: string;
  walk_in_name: string;
  date: string;
  hour: number;
  duration: number;
  notes: string;
};

const DURATIONS = [60, 90, 120];

/** A no-show from the last 90 days, used to count them per player. */
export type NoShow = Pick<Booking, "id" | "player_id" | "member_id">;

interface Props {
  bookings: BookingWithJoins[];
  courts: Pick<Court, "id" | "name" | "price_per_hour">[];
  members: Pick<Member, "id" | "full_name">[];
  noShows: NoShow[];
  /** Online booking pauses at this many no-shows. 0 = never. */
  maxNoShows: number;
}

/** Who a booking belongs to: a player account or a club member. */
const personKey = (b: Pick<Booking, "player_id" | "member_id">) =>
  b.player_id ? `p:${b.player_id}` : b.member_id ? `m:${b.member_id}` : null;

export default function BookingsClient({
  bookings: initial,
  courts,
  members,
  noShows,
  maxNoShows,
}: Props) {
  const [bookings, setBookings] = useState(initial);
  const [showModal, setShowModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const t = useTranslations("adminBookings");
  const labels = useLabels();
  const locale = useLocale();
  const dfLocale = dateLocale(locale);

  const filter = (searchParams.get("status") ?? "all") as BookingStatus | "all";

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      court_id: "",
      player_type: "member",
      member_id: "",
      walk_in_name: "",
      date: format(new Date(), "yyyy-MM-dd"),
      hour: 9,
      duration: 60,
      notes: "",
    },
  });

  const watchedCourt = watch("court_id");
  const watchedDuration = watch("duration");
  const watchedType = watch("player_type");
  const selectedCourt = courts.find((c) => c.id === watchedCourt);
  const total = selectedCourt
    ? (selectedCourt.price_per_hour * watchedDuration) / 60
    : 0;
  const days = Array.from({ length: 14 }, (_, i) =>
    addDays(startOfDay(new Date()), i),
  );

  const setFilter = (status: BookingStatus | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") params.delete("status");
    else params.set("status", status);
    router.push(`/${locale}/admin/bookings?${params.toString()}`);
  };

  const onSubmit = async (values: FormValues) => {
    const startsAt = setMinutes(
      setHours(new Date(values.date), values.hour),
      0,
    );
    const endsAt = new Date(startsAt.getTime() + values.duration * 60 * 1000);

    const payload = {
      court_id: values.court_id,
      member_id:
        values.player_type === "member" && values.member_id
          ? values.member_id
          : null,
      walk_in_name:
        values.player_type === "walkin" && values.walk_in_name
          ? values.walk_in_name
          : null,
      player_id: null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      duration_min: values.duration,
      total_price: total,
      status: "confirmed",
      notes: values.notes || null,
    } as unknown as never;

    setSubmitError(null);

    const { data, error } = (await supabase
      .from("bookings")
      .insert(payload)
      .select("*, court:courts(name), member:members(full_name)")
      .single()) as {
      data: BookingWithJoins | null;
      error: { code?: string } | null;
    };

    if (error || !data) {
      // 23P01 is the database's code for "overlaps an existing booking"
      setSubmitError(error?.code === "23P01" ? t("slotTaken") : t("saveError"));
      return;
    }

    setBookings((prev) => [data, ...prev]);
    setShowModal(false);
    reset();
  };

  const handleStatus = async (id: string, status: BookingStatus) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("bookings") as any)
      .update({ status })
      .eq("id", id);
    // Only show the change if it was really saved.
    if (error) return;
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status } : b)),
    );
  };

  // No-shows per player in the last 90 days. Bookings on screen use their
  // current status, so marking or un-marking one updates the count at once.
  const since = noShowCutoff().getTime();
  const onScreen = new Set(bookings.map((b) => b.id));
  const noShowCount = new Map<string, number>();
  for (const b of [
    ...noShows.filter((n) => !onScreen.has(n.id)),
    ...bookings.filter(
      (b) => b.status === "no_show" && new Date(b.starts_at).getTime() >= since,
    ),
  ]) {
    const key = personKey(b);
    if (key) noShowCount.set(key, (noShowCount.get(key) ?? 0) + 1);
  }

  const filtered = bookings
    .filter((b) => filter === "all" || b.status === filter)
    .filter((b) => {
      const name =
        b.member?.full_name ?? b.player?.full_name ?? b.walk_in_name ?? "";
      return (
        name.toLowerCase().includes(search.toLowerCase()) ||
        b.reference.toLowerCase().includes(search.toLowerCase()) ||
        b.court?.name?.toLowerCase().includes(search.toLowerCase())
      );
    });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-[#111c0a]">
            {t("title")}
          </h1>
          <p className="text-sm text-[#6e7f65] mt-1">
            {bookings.length} {t("total")}
          </p>
        </div>
        <button
          onClick={() => {
            reset();
            setShowModal(true);
          }}
          className="btn-primary"
        >
          {t("addBooking")}
        </button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <div className="flex gap-2 flex-wrap">
          {(["all", ...BOOKING_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-4 py-2 rounded-full border transition-colors ${
                filter === s
                  ? "bg-[#111c0a] text-white border-[#111c0a]"
                  : "border-[#e8ede4] text-[#6e7f65] hover:bg-[#f8f9f7]"
              }`}
            >
              {s === "all" ? t("statusLabels.all") : labels.bookingStatus(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#e8ede4] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e8ede4] bg-[#f8f9f7]">
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("ref")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("player")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("court")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("dateTime")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("duration")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("total")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("status")}
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {!filtered.length ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
                  <p className="text-sm text-[#6e7f65]">{t("noBookings")}</p>
                  {bookings.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        reset();
                        setShowModal(true);
                      }}
                      className="btn-primary mt-4"
                    >
                      {t("addBooking")}
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((b, i) => (
                <tr
                  key={b.id}
                  className={`border-b border-[#e8ede4] hover:bg-[#f8f9f7] transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}
                >
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-medium text-[#7aad12] font-mono">
                      {b.reference}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-[#111c0a]">
                      {b.member?.full_name ??
                        b.player?.full_name ??
                        b.walk_in_name ??
                        "—"}
                    </div>
                    {b.walk_in_name && (
                      <div className="text-xs text-[#6e7f65]">
                        {t("walkIn")}
                      </div>
                    )}
                    <NoShowBadge
                      count={noShowCount.get(personKey(b) ?? "") ?? 0}
                      paused={
                        maxNoShows > 0 &&
                        !!b.player_id &&
                        (noShowCount.get(personKey(b) ?? "") ?? 0) >= maxNoShows
                      }
                    />
                  </td>
                  <td className="px-5 py-3.5 text-[#3d4f35]">
                    {b.court?.name ??
                      (b.coach
                        ? `${t("lesson")} · ${b.coach.profile?.full_name ?? ""}`
                        : "—")}
                  </td>
                  <td className="px-5 py-3.5 text-[#3d4f35]">
                    {format(new Date(b.starts_at), "EEE d MMM, HH:mm", { locale: dfLocale })}
                  </td>
                  <td className="px-5 py-3.5 text-[#3d4f35]">
                    {b.duration_min} {t("min")}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-[#111c0a]">
                    €{b.total_price.toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`${BADGE} ${bookingStatusTone(b.status)}`}>
                      {labels.bookingStatus(b.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={b.status}
                      onChange={(e) =>
                        handleStatus(b.id, e.target.value as BookingStatus)
                      }
                      className="text-xs border border-[#e8ede4] rounded-lg px-2 py-1 text-[#3d4f35] bg-white focus:outline-none focus:ring-1 focus:ring-[#d6f09a]"
                    >
                      {BOOKING_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {labels.bookingStatus(s)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <Modal.Content className="max-w-lg">
          <Modal.Header>{t("addBooking")}</Modal.Header>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Modal.Body>
              <Modal.Field label={t("court")} required>
                <select
                  className="input"
                  {...register("court_id", { required: true })}
                >
                  <option value="">{t("selectCourt")}</option>
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — €{c.price_per_hour}/hr
                    </option>
                  ))}
                </select>
              </Modal.Field>

              <div>
                <p className="text-xs text-ink-400 mb-2">{t("player")}</p>
                <div className="flex gap-2 mb-3">
                  {(["member", "walkin"] as const).map((type) => (
                    <Controller
                      key={type}
                      name="player_type"
                      control={control}
                      render={({ field }) => (
                        <button
                          type="button"
                          onClick={() => field.onChange(type)}
                          className={`text-xs px-4 py-1.5 rounded-full border transition-colors ${
                            field.value === type
                              ? "bg-[#111c0a] text-white border-[#111c0a]"
                              : "border-[#e8ede4] text-[#6e7f65] hover:bg-[#f8f9f7]"
                          }`}
                        >
                          {type === "member" ? t("member") : t("walkIn")}
                        </button>
                      )}
                    />
                  ))}
                </div>
                {watchedType === "member" ? (
                  <select className="input" {...register("member_id")}>
                    <option value="">{t("selectMember")}</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    placeholder={t("fullName")}
                    {...register("walk_in_name")}
                  />
                )}
              </div>

              <Modal.Field label={t("date")}>
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
                                ? "bg-[#111c0a] text-white border-[#111c0a]"
                                : "border-[#e8ede4] text-[#6e7f65] hover:bg-[#f8f9f7]"
                            }`}
                          >
                            <div className="font-medium">
                              {format(day, "EEE", { locale: dfLocale })}
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
                <Modal.Field label={t("startTime")}>
                  <select
                    className="input"
                    {...register("hour", { valueAsNumber: true })}
                  >
                    {DAY_HOURS.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </Modal.Field>
                <Modal.Field label={t("duration")}>
                  <select
                    className="input"
                    {...register("duration", { valueAsNumber: true })}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} {t("min")}
                      </option>
                    ))}
                  </select>
                </Modal.Field>
              </Modal.Grid>

              <Modal.Field label={t("notes")}>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder={t("notesPlaceholder")}
                  {...register("notes")}
                />
              </Modal.Field>

              {selectedCourt && (
                <div className="bg-[#f8f9f7] border border-[#e8ede4] rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-[#6e7f65]">
                    {watchedDuration} {t("min")} · {selectedCourt.name}
                  </span>
                  <span className="text-sm font-medium text-[#111c0a]">
                    €{total.toFixed(2)}
                  </span>
                </div>
              )}
              {submitError && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {submitError}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary flex-1"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {isSubmitting ? t("saving") : t("confirmBooking")}
              </button>
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal>
    </div>
  );
}

/** "2 no-shows" under a player's name; red once online booking is paused. */
function NoShowBadge({ count, paused }: { count: number; paused: boolean }) {
  const t = useTranslations("adminBookings");
  if (count === 0) return null;
  return (
    <div
      className={`mt-1 inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
        paused ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
      }`}
      title={paused ? t("pausedHint") : undefined}
    >
      {t("noShowCount", { n: count })}
      {paused && <> · {t("paused")}</>}
    </div>
  );
}
