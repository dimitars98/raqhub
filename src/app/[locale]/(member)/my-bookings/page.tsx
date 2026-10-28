import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Check, Calendar, RotateCcw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { cancelBooking } from "@/app/actions/bookings";
import type { Booking, Court, Profile } from "@/types/database";
import { canCancel, normalizeRules } from "@/lib/bookingRules";
import { getLabels } from "@/lib/getLabels";
import { intlLocale } from "@/lib/dateLocale";
import type { Labels } from "@/lib/labels";
import { BADGE, bookingStatusTone } from "@/lib/badges";

type ClubRules = { booking_rules: unknown } | null;

type BookingWithJoins = Booking & {
  court?: (Pick<Court, "name"> & { club?: ClubRules }) | null;
  coach?: { profile?: Pick<Profile, "full_name"> | null; club?: ClubRules } | null;
};

type T = Awaited<ReturnType<typeof getTranslations<"myBookings">>>;
type TP = Awaited<ReturnType<typeof getTranslations<"payments">>>;

// Clubs are in Skopje; times are shown in the club's time, whatever the device.
const TIME_ZONE = "Europe/Skopje";

/** Formats a date in the club's time zone and the page's language. */
function makeFormatter(locale: string) {
  return (value: string | Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TIME_ZONE, ...options }).format(
      typeof value === "string" ? new Date(value) : value,
    );
}
type Fmt = ReturnType<typeof makeFormatter>;

/** yyyy-mm-dd of a moment in the club's time zone, for comparing days. */
const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);

function bookingName(b: BookingWithJoins, t: T) {
  if (b.coach) {
    const lesson = t("lesson", { name: b.coach.profile?.full_name ?? "" });
    return b.court?.name ? `${lesson} · ${b.court.name}` : lesson;
  }
  if (b.court?.name) return b.court.name;
  return t("booking");
}

function relativeLabel(startsAt: string, t: T) {
  const date = new Date(startsAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs < 0) return null;
  const diffHours = diffMs / 3_600_000;
  if (diffHours < 1) return t("inMinutes", { n: Math.max(1, Math.round(diffMs / 60_000)) });
  if (diffHours < 24) return t("inHours", { n: Math.round(diffHours) });
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (dayKey(date) === dayKey(tomorrow)) return t("tomorrow");
  return null;
}

/** A link that opens Google Calendar with the booking filled in. */
function calendarLink(b: BookingWithJoins, title: string) {
  const stamp = (v: string) => new Date(v).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${stamp(b.starts_at)}/${stamp(b.ends_at)}`,
    details: `Kortello · ${b.reference}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string; payment?: string }>;
}) {
  const { booked, payment } = await searchParams;
  const supabase = await createClient();
  const t = await getTranslations("myBookings");
  const tp = await getTranslations("payments");
  const locale = await getLocale();
  const fmt = makeFormatter(locale);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Bookings the player made, plus those the club made for their membership.
  const { data: memberIds } = await supabase.rpc("my_member_ids");
  const ids = (memberIds ?? []) as string[];

  let query = supabase
    .from("bookings")
    .select(
      "*, court:courts(name, club:clubs(booking_rules)), coach:coaches(profile:profiles(full_name), club:clubs(booking_rules))",
    )
    .order("starts_at", { ascending: false });
  query = ids.length
    ? query.or(`player_id.eq.${user.id},member_id.in.(${ids.join(",")})`)
    : query.eq("player_id", user.id);

  const { data } = await query;
  const bookings = (data ?? []) as BookingWithJoins[];
  const now = new Date();

  const isOpen = (b: BookingWithJoins) =>
    new Date(b.starts_at) >= now && (b.status === "confirmed" || b.status === "pending");

  const allUpcoming = bookings
    .filter(isOpen)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const past = bookings.filter((b) => !isOpen(b));

  const nextBooking = allUpcoming[0] ?? null;
  const restUpcoming = allUpcoming.slice(1);

  // Stats
  const played = bookings.filter(
    (b) =>
      b.status === "completed" ||
      (new Date(b.starts_at) < now && b.status !== "cancelled" && b.status !== "no_show"),
  );
  const totalSessions = played.length;
  const totalHours = Math.round(played.reduce((acc, b) => acc + (b.duration_min ?? 0), 0) / 60);
  const totalSpent = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((acc, b) => acc + (b.total_price ?? 0), 0);

  // Week strip, Monday to Sunday of this week (club time)
  const todayKey = dayKey(now);
  const weekdayIndex = (new Date(`${todayKey}T12:00:00`).getDay() + 6) % 7;
  const monday = new Date(`${todayKey}T12:00:00`);
  monday.setDate(monday.getDate() - weekdayIndex);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const key = dayKey(day);
    return {
      day,
      key,
      hasBooking: bookings.some(
        (b) => b.status !== "cancelled" && dayKey(new Date(b.starts_at)) === key,
      ),
    };
  });

  const labels = await getLabels();
  const ctx = { t, fmt, userId: user.id, labels, tp, locale };

  return (
    <div className="max-w-2xl mx-auto">
      {booked === "1" && (
        <div className="flex items-center gap-3 px-4 py-3 mb-6 rounded-xl border border-brand-200 bg-brand-50">
          <div className="w-7 h-7 rounded-full bg-brand-200 flex items-center justify-center flex-shrink-0">
            <Check size={14} className="text-brand-800" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-900">{t("bookedTitle")}</p>
            <p className="text-xs text-brand-800">{t("bookedText")}</p>
          </div>
        </div>
      )}

      {(payment === "late" || payment === "check") && (
        <p role="status" className="mb-6 rounded-xl border border-[#f2dfa6] bg-[#fdf5df] px-4 py-3 text-sm text-[#5c4000]">
          {tp(payment === "late" ? "mine.late" : "mine.check")}
        </p>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="text-xs text-ink-400 mb-0.5 first-letter:uppercase">
            {fmt(now, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-2xl font-medium text-ink-900">{t("title")}</h1>
        </div>
        <Link href="/book" className="btn-primary text-sm">
          {t("bookCourt")}
        </Link>
      </div>

      {/* Stats row */}
      <div className="card px-5 py-4 mb-3 grid grid-cols-3 divide-x divide-ink-100">
        <div className="flex flex-col items-center gap-0.5 pr-4">
          <span className="text-xl font-medium text-ink-900">{totalSessions}</span>
          <span className="text-xs text-ink-400">{t("sessions")}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-4">
          <span className="text-xl font-medium text-ink-900">{totalHours}h</span>
          <span className="text-xs text-ink-400">{t("hoursPlayed")}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 pl-4">
          <span className="text-xl font-medium text-ink-900">€{totalSpent.toFixed(0)}</span>
          <span className="text-xs text-ink-400">{t("totalSpent")}</span>
        </div>
      </div>

      {/* Week strip */}
      <div className="card px-5 py-4 mb-7">
        <p className="text-xs text-ink-400 mb-3">{t("thisWeek")}</p>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(({ day, key, hasBooking }) => {
            const isCurrentDay = key === todayKey;
            return (
              <div key={key} className="flex flex-col items-center gap-1.5">
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    isCurrentDay ? "text-brand-800 font-medium" : "text-ink-400"
                  }`}
                >
                  {fmt(day, { weekday: "short" })}
                </span>
                <span
                  className={`text-sm font-medium ${isCurrentDay ? "text-brand-800" : "text-ink-900"}`}
                >
                  {fmt(day, { day: "numeric" })}
                </span>
                <div
                  className={`w-1.5 h-1.5 rounded-full ${hasBooking ? "bg-brand-600" : "bg-ink-100"}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Next up */}
      {nextBooking ? (
        <section className="mb-7">
          <h2 className="text-xs font-medium text-ink-400 uppercase tracking-widest mb-3">
            {t("nextUp")}
          </h2>
          <NextUpCard booking={nextBooking} {...ctx} />
        </section>
      ) : (
        <div className="card p-8 text-center mb-7">
          <p className="text-sm text-ink-400 mb-4">{t("noUpcoming")}</p>
          <Link href="/book" className="btn-primary text-sm">
            {t("bookCourt")}
          </Link>
        </div>
      )}

      {restUpcoming.length > 0 && (
        <section className="mb-7">
          <h2 className="text-xs font-medium text-ink-400 uppercase tracking-widest mb-3">
            {t("upcoming")}
          </h2>
          <div className="flex flex-col gap-2">
            {restUpcoming.map((b) => (
              <BookingRow key={b.id} booking={b} {...ctx} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-ink-400 uppercase tracking-widest mb-3">
            {t("past")}
          </h2>
          <div className="flex flex-col gap-2 opacity-70">
            {past.map((b) => (
              <BookingRow key={b.id} booking={b} past {...ctx} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type RowProps = { booking: BookingWithJoins; t: T; fmt: Fmt; userId: string; labels: Labels; tp: TP; locale: string };

/**
 * Only bookings the player made themselves can be cancelled here, and only
 * until the club's cancellation deadline; after that they're asked to call.
 */
function CancelButton({
  b,
  userId,
  label,
  closedLabel,
}: {
  b: BookingWithJoins;
  userId: string;
  label: string;
  closedLabel: string;
}) {
  if (b.player_id !== userId) return null;
  const rules = normalizeRules(b.court?.club?.booking_rules ?? b.coach?.club?.booking_rules);
  if (!canCancel(b.starts_at, rules)) {
    return <span className="text-xs text-ink-400">{closedLabel}</span>;
  }
  return (
    <form action={cancelBooking}>
      <input type="hidden" name="id" value={b.id} />
      <button type="submit" className="text-xs text-red-500 hover:text-red-700 transition-colors">
        {label}
      </button>
    </form>
  );
}

/** Paid online, waiting for payment, refunded… (20261029_online_payments.sql) */
function PaymentNote({ b, tp, locale }: { b: BookingWithJoins; tp: TP; locale: string }) {
  const status = b.payment_status ?? "none";
  if (status === "none" || status === "expired") return null;
  if (status === "pending" && b.status === "pending") {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="font-medium text-[#7a5600]">{tp("mine.pending")}</span>
        <a
          href={`/api/stripe/resume?booking=${b.id}&locale=${locale}`}
          className="font-semibold text-ink-900 underline underline-offset-2"
        >
          {tp("mine.finish")}
        </a>
      </span>
    );
  }
  const tone = status === "paid" ? "text-brand-800" : "text-ink-600";
  return <span className={`text-xs font-medium ${tone}`}>{tp(`mine.${status === "refund_due" ? "refundDue" : status}`)}</span>;
}

function ClubMadeNote({ b, userId, t }: { b: BookingWithJoins; userId: string; t: T }) {
  if (b.player_id === userId) return null;
  return <span className="text-xs text-ink-400">{t("madeByClub")}</span>;
}

function NextUpCard({ booking: b, t, fmt, userId, labels, tp, locale }: RowProps) {
  const name = bookingName(b, t);
  const label = relativeLabel(b.starts_at, t);

  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 px-5 py-4">
        <div className="flex flex-col items-center justify-center bg-brand-50 rounded-xl px-4 py-3 flex-shrink-0 min-w-[56px]">
          <span className="text-2xl font-medium text-brand-800 leading-none">
            {fmt(b.starts_at, { day: "numeric" })}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-brand-800 mt-0.5">
            {fmt(b.starts_at, { month: "short" })}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-base font-medium text-ink-900 truncate">{name}</span>
            <span className={`${BADGE} ${bookingStatusTone(b.status)}`}>{labels.bookingStatus(b.status)}</span>
          </div>
          <p className="text-sm text-ink-600 mb-2.5">
            {fmt(b.starts_at, { hour: "2-digit", minute: "2-digit" })} ·{" "}
            {t("minutes", { n: b.duration_min })} · €
            {b.total_price.toFixed(2)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-400">
              {t("ref")}: <span className="text-ink-600 font-medium">{b.reference}</span>
            </span>
            {label && (
              <>
                <span className="text-ink-200">·</span>
                <span className="text-xs font-medium text-brand-800">{label}</span>
              </>
            )}
            <ClubMadeNote b={b} userId={userId} t={t} />
            <PaymentNote b={b} tp={tp} locale={locale} />
          </div>
        </div>
      </div>

      <div className="border-t border-ink-100 px-5 py-3 flex items-center justify-between">
        <a
          href={calendarLink(b, name)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-ink-600 hover:text-ink-900 transition-colors"
        >
          <Calendar size={13} aria-hidden="true" />
          {t("addToCalendar")}
        </a>
        <CancelButton
          b={b}
          userId={userId}
          label={t("cancelBooking")}
          closedLabel={t("cancelClosed")}
        />
      </div>
    </div>
  );
}

function BookingRow({
  booking: b,
  t,
  fmt,
  userId,
  labels,
  tp,
  locale,
  past = false,
}: RowProps & { past?: boolean }) {
  const name = bookingName(b, t);

  return (
    <div className="card px-5 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900 truncate">{name}</p>
          <p className="text-xs text-ink-400 mt-0.5">
            {fmt(b.starts_at, {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {t("minutes", { n: b.duration_min })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`${BADGE} ${bookingStatusTone(b.status)}`}>{labels.bookingStatus(b.status)}</span>
          <span className="text-sm font-medium text-ink-800">€{b.total_price.toFixed(2)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 mt-2.5 pt-2.5 border-t border-ink-100">
        <span className="text-xs text-ink-400">
          {t("ref")}: <span className="font-medium text-ink-600">{b.reference}</span>{" "}
          <ClubMadeNote b={b} userId={userId} t={t} />{" "}
          <PaymentNote b={b} tp={tp} locale={locale} />
        </span>
        {past ? (
          <Link
            href={b.coach ? "/coaches" : "/book"}
            className="flex items-center gap-1 text-xs text-ink-600 hover:text-ink-900 transition-colors"
          >
            <RotateCcw size={11} aria-hidden="true" />
            {t("bookAgain")}
          </Link>
        ) : (
          <CancelButton
            b={b}
            userId={userId}
            label={t("cancel")}
            closedLabel={t("cancelClosed")}
          />
        )}
      </div>
    </div>
  );
}
