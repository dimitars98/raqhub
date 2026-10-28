"use client";

import { dateLocale } from "@/lib/dateLocale";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { type ReadonlyURLSearchParams, useRouter, useSearchParams } from "next/navigation";
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
import { REPEAT_CHOICES, weeklyStarts } from "@/lib/recurring";
import { Repeat, X } from "lucide-react";
import { useReadOnly } from "@/components/admin/ReadOnly";
import SelectField from "@/components/ui/SelectField";
import { bookingName } from "@/lib/bookingName";
import PaymentTag from "@/components/admin/PaymentTag";
import { settleClubRefunds } from "@/app/[locale]/admin/settings/payments";

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
  /** Weeks in a row, 1 = just once. */
  repeat: number;
  notes: string;
};

/** Shown after a weekly booking: how many were added, which weeks were taken. */
type SeriesNotice = { added: number; skipped: Date[] };

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
  const searchParams = useSearchParams();
  // The timetable's "+" opens the form straight away (?new=1&court=&date=&hour=).
  const [showModal, setShowModal] = useState(() => searchParams.get("new") === "1");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<SeriesNotice | null>(null);
  // A status change or cancellation that didn't save.
  const [rowError, setRowError] = useState<string | null>(null);
  /** A weekly booking the admin is about to cancel: just it, or later weeks too? */
  const [cancelling, setCancelling] = useState<BookingWithJoins | null>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("adminBookings");
const { readOnly, hint } = useReadOnly();
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
    defaultValues: prefill(searchParams, courts),
  });

  const watchedCourt = watch("court_id");
  const watchedDuration = watch("duration");
  const watchedType = watch("player_type");
  const watchedRepeat = watch("repeat");
  const selectedCourt = courts.find((c) => c.id === watchedCourt);
  const total = selectedCourt
    ? (selectedCourt.price_per_hour * watchedDuration) / 60
    : 0;
  const days = Array.from({ length: 14 }, (_, i) =>
    addDays(startOfDay(new Date()), i),
  );

  /** Closes the form and drops the timetable's ?new=1 so a reload doesn't reopen it. */
  const closeModal = () => {
    setShowModal(false);
    if (searchParams.get("new")) {
      const params = new URLSearchParams(searchParams.toString());
      for (const k of ["new", "court", "date", "hour"]) params.delete(k);
      const q = params.toString();
      router.replace(`/${locale}/admin/bookings${q ? `?${q}` : ""}`);
    }
  };

  const setFilter = (status: BookingStatus | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") params.delete("status");
    else params.set("status", status);
    router.push(`/${locale}/admin/bookings?${params.toString()}`);
  };

  const onSubmit = async (values: FormValues) => {
    // The chosen day at the chosen hour, in the admin's own time.
    const first = setMinutes(setHours(new Date(`${values.date}T00:00`), values.hour), 0);
    const weeks = values.repeat > 1 ? values.repeat : 1;
    const seriesId = weeks > 1 ? crypto.randomUUID() : null;

    const bookingAt = (startsAt: Date) =>
      ({
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
        ends_at: new Date(startsAt.getTime() + values.duration * 60_000).toISOString(),
        duration_min: values.duration,
        total_price: total,
        status: "confirmed",
        notes: values.notes || null,
        series_id: seriesId,
      }) as unknown as never;

    setSubmitError(null);
    setNotice(null);

    // One week at a time, so a week that is already taken is skipped
    // instead of stopping the whole series.
    const added: BookingWithJoins[] = [];
    const skipped: Date[] = [];
    let failed = false;
    // A week that falls on a closed court (20261027_court_closures.sql).
    let closed = 0;
    for (const startsAt of weeklyStarts(first, weeks)) {
      const { data, error } = (await supabase
        .from("bookings")
        .insert(bookingAt(startsAt))
        .select("*, court:courts(name), member:members(full_name)")
        .single()) as {
        data: BookingWithJoins | null;
        error: { code?: string; message?: string } | null;
      };
      // 23P01 is the database's code for "overlaps an existing booking"
      // (and for a closed court, with "court_closed" in the message).
      if (error?.code === "23P01") {
        skipped.push(startsAt);
        if (error.message?.includes("court_closed")) closed++;
      }
      else if (error || !data) {
        failed = true;
        break;
      } else added.push(data);
    }

    if (added.length === 0) {
      setSubmitError(
        failed
          ? t("saveError")
          : weeks > 1
            ? t("allWeeksTaken")
            : closed
              ? t("courtClosed")
              : t("slotTaken"),
      );
      return;
    }

    setBookings((prev) => [...added.reverse(), ...prev]);
    if (weeks > 1) setNotice({ added: added.length, skipped });
    if (failed) {
      // Some weeks were saved before something went wrong: keep the form
      // open so the admin sees it, and show what was added.
      setSubmitError(t("saveError"));
      return;
    }
    closeModal();
    reset(prefill(null, courts));
  };

  /** Cancels a weekly booking and, if asked, every later week of it. */
  const cancelSeries = async (b: BookingWithJoins, later: boolean) => {
    setCancelling(null);
    if (!later || !b.series_id) return handleStatus(b.id, "cancelled");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("bookings") as any)
      .update({ status: "cancelled" })
      .eq("series_id", b.series_id)
      .gte("starts_at", b.starts_at)
      .eq("status", "confirmed");
    if (error) {
      console.error("[bookings] cancel series", error);
      setRowError(readOnly ? hint ?? null : t("statusFailed"));
      return;
    }
    setBookings((prev) =>
      prev.map((x) =>
        x.series_id === b.series_id &&
        x.status === "confirmed" &&
        x.starts_at >= b.starts_at
          ? { ...x, status: "cancelled", payment_status: x.payment_status === "paid" ? "refund_due" : x.payment_status }
          : x,
      ),
    );
    void settleClubRefunds();
  };

  const handleStatus = async (id: string, status: BookingStatus) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("bookings") as any)
      .update({ status })
      .eq("id", id);
    // Only show the change if it was really saved.
    if (error) {
      console.error("[bookings] status", error);
      setRowError(readOnly ? hint ?? null : t("statusFailed"));
      return;
    }
    setRowError(null);
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status,
              // Paid online: the money goes back (20261029_online_payments.sql).
              payment_status:
                status === "cancelled" && b.payment_status === "paid" ? "refund_due" : b.payment_status,
            }
          : b,
      ),
    );
    if (status === "cancelled") void settleClubRefunds();
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
      const name = bookingName(b, "");
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
          disabled={readOnly}
          title={hint}
          onClick={() => {
            reset(prefill(null, courts));
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

      {rowError && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {rowError}
        </p>
      )}

      {notice && (
        <div
          role="status"
          className="mb-4 flex items-start gap-3 rounded-xl border border-[#d6f09a] bg-[#f3fbde] px-4 py-3 text-sm text-[#2e4d03]"
        >
          <Repeat size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">{t("addedSeries", { n: notice.added })}</p>
            {notice.skipped.length > 0 && (
              <p className="mt-0.5 text-[#4d7a08]">
                {t("skippedWeeks", {
                  dates: notice.skipped
                    .map((d) => format(d, "EEE d MMM", { locale: dfLocale }))
                    .join(", "),
                })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label={t("dismiss")}
            className="shrink-0 rounded p-0.5 hover:bg-[#e3f5b8]"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
                      disabled={readOnly}
                      title={hint}
                      type="button"
                      onClick={() => {
                        reset(prefill(null, courts));
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
                      {bookingName(b, "—")}
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
                    {b.series_id && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#f3fbde] px-2 py-0.5 text-[11px] font-medium text-[#4d7a08]">
                        <Repeat size={11} aria-hidden="true" /> {t("weekly")}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[#3d4f35]">
                    {b.duration_min} {t("min")}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-[#111c0a]">
                    €{b.total_price.toFixed(2)}
                    <PaymentTag status={b.payment_status} className="ml-1.5" />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`${BADGE} ${bookingStatusTone(b.status)}`}>
                      {labels.bookingStatus(b.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="w-32">
                      <SelectField
                        size="xs"
                        ariaLabel={t("status")}
                        disabled={readOnly}
                        title={hint}
                        value={b.status}
                        onChange={(v) => {
                          const status = v as BookingStatus;
                          if (status === "cancelled" && b.series_id) setCancelling(b);
                          else handleStatus(b.id, status);
                        }}
                        options={BOOKING_STATUSES.map((s) => ({ value: s, label: labels.bookingStatus(s) }))}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={closeModal}>
        <Modal.Content className="max-w-lg">
          <Modal.Header>{t("addBooking")}</Modal.Header>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Modal.Body>
              <Modal.Field label={t("court")} required>
                <Controller
                  name="court_id"
                  control={control}
                  rules={{ required: true }}
                  render={({ field, fieldState }) => (
                    <SelectField
                      ariaLabel={t("court")}
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!fieldState.error}
                      options={[
                        { value: "", label: t("selectCourt") },
                        ...courts.map((c) => ({ value: c.id, label: `${c.name} — €${c.price_per_hour}/hr` })),
                      ]}
                    />
                  )}
                />
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
                  <Controller
                    name="member_id"
                    control={control}
                    render={({ field }) => (
                      <SelectField
                        ariaLabel={t("member")}
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { value: "", label: t("selectMember") },
                          ...members.map((m) => ({ value: m.id, label: m.full_name })),
                        ]}
                      />
                    )}
                  />
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
                  <Controller
                    name="hour"
                    control={control}
                    render={({ field }) => (
                      <SelectField
                        ariaLabel={t("startTime")}
                        value={String(field.value)}
                        onChange={(v) => field.onChange(Number(v))}
                        options={DAY_HOURS.map((h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }))}
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
                        options={DURATIONS.map((d) => ({ value: String(d), label: `${d} ${t("min")}` }))}
                      />
                    )}
                  />
                </Modal.Field>
              </Modal.Grid>

              <Modal.Field label={t("repeat")}>
                <Controller
                  name="repeat"
                  control={control}
                  render={({ field }) => (
                    <SelectField
                      ariaLabel={t("repeat")}
                      value={String(field.value)}
                      onChange={(v) => field.onChange(Number(v))}
                      options={REPEAT_CHOICES.map((n) => ({
                        value: String(n),
                        label: n === 1 ? t("repeatOnce") : t("repeatWeeks", { n }),
                      }))}
                    />
                  )}
                />
                {watchedRepeat > 1 && (
                  <p className="mt-1.5 text-xs text-[#6e7f65]">{t("repeatHint")}</p>
                )}
              </Modal.Field>

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
                  <span className="text-right text-sm font-medium text-[#111c0a]">
                    €{total.toFixed(2)}
                    {watchedRepeat > 1 && (
                      <span className="block text-xs font-normal text-[#6e7f65]">
                        {t("seriesTotal", {
                          n: watchedRepeat,
                          total: (total * watchedRepeat).toFixed(2),
                        })}
                      </span>
                    )}
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
                onClick={closeModal}
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

      <Modal open={!!cancelling} onClose={() => setCancelling(null)}>
        <Modal.Content className="max-w-md">
          <Modal.Header>{t("cancelSeriesTitle")}</Modal.Header>
          <Modal.Body>
            <p className="text-sm text-[#3d4f35]">
              {cancelling &&
                t("cancelSeriesText", {
                  date: format(new Date(cancelling.starts_at), "EEE d MMM, HH:mm", {
                    locale: dfLocale,
                  }),
                })}
            </p>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={() => cancelling && cancelSeries(cancelling, false)}
              className="btn-secondary flex-1"
            >
              {t("cancelOnlyThis")}
            </button>
            <button
              type="button"
              onClick={() => cancelling && cancelSeries(cancelling, true)}
              className="btn-primary flex-1"
            >
              {t("cancelThisAndLater")}
            </button>
          </Modal.Footer>
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

/** The booking form's starting values, taken from the timetable's link when there is one. */
function prefill(params: URLSearchParams | ReadonlyURLSearchParams | null, courts: { id: string }[]): FormValues {
  const today = startOfDay(new Date());
  const date = params?.get("date") ?? "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00`) : null;
  // Only days the form offers: today and the next 13.
  const inRange = day && day >= today && day < addDays(today, 14);
  const hour = Number(params?.get("hour"));
  const court = params?.get("court") ?? "";
  return {
    court_id: courts.some((c) => c.id === court) ? court : "",
    player_type: "member",
    member_id: "",
    walk_in_name: "",
    date: inRange ? date : format(today, "yyyy-MM-dd"),
    hour: DAY_HOURS.includes(hour) ? hour : 9,
    duration: 60,
    repeat: 1,
    notes: "",
  };
}
