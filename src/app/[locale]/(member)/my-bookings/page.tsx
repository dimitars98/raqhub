import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format, isToday, isTomorrow, startOfWeek, addDays } from "date-fns";
import type { Booking, Court, Coach, Profile } from "@/types/database";
import { Check, Calendar, RotateCcw } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { revalidatePath } from "next/cache";

type BookingWithJoins = Booking & {
  court?: Pick<Court, "name"> | null;
  coach?: { profile?: Pick<Profile, "full_name"> | null } | null;
};

function getBookingLabel(startsAt: string) {
  const date = new Date(startsAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) return null;
  if (diffHours < 1) return `In ${Math.round(diffMs / 60000)} min`;
  if (diffHours < 24) return `In ${Math.round(diffHours)} hours`;
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return null;
}

const STATUS_STYLE: Record<string, string> = {
  confirmed:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800",
  pending:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-100 text-accent-800",
  cancelled:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-400",
  completed:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-court-100 text-court-800",
  no_show:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700",
};

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: { booked?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("bookings")
    .select("*, court:courts(name), coach:coaches(profile:profiles(full_name))")
    .eq("player_id", user.id)
    .order("starts_at", { ascending: false });

  const bookings = (data ?? []) as BookingWithJoins[];

  const now = new Date();

  const allUpcoming = bookings
    .filter(
      (b) =>
        new Date(b.starts_at) >= now &&
        (b.status === "confirmed" || b.status === "pending"),
    )
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );

  const past = bookings.filter(
    (b) =>
      new Date(b.starts_at) < now ||
      b.status === "cancelled" ||
      b.status === "completed" ||
      b.status === "no_show",
  );

  const nextBooking = allUpcoming[0] ?? null;
  const restUpcoming = allUpcoming.slice(1);

  // Stats
  const completedBookings = bookings.filter(
    (b) =>
      b.status === "completed" ||
      (new Date(b.starts_at) < now &&
        b.status !== "cancelled" &&
        b.status !== "no_show"),
  );
  const totalSessions = completedBookings.length;
  const totalMinutes = completedBookings.reduce(
    (acc, b) => acc + (b.duration_min ?? 0),
    0,
  );
  const totalHours = Math.round(totalMinutes / 60);
  const totalSpent = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((acc, b) => acc + (b.total_price ?? 0), 0);

  // Week strip — Mon to Sun of current week
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const hasBooking = bookings.some((b) => {
      const bd = new Date(b.starts_at);
      return (
        bd.getDate() === day.getDate() &&
        bd.getMonth() === day.getMonth() &&
        bd.getFullYear() === day.getFullYear() &&
        b.status !== "cancelled"
      );
    });
    return { day, hasBooking };
  });

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Success toast */}
      {searchParams.booked === "1" && (
        <div className="flex items-center gap-3 px-4 py-3 mb-6 rounded-xl border border-brand-200 bg-brand-50">
          <div className="w-7 h-7 rounded-full bg-brand-200 flex items-center justify-center flex-shrink-0">
            <Check size={14} color="#3a7020" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-900">
              Booking confirmed!
            </p>
            <p className="text-xs text-brand-600">See you on the court.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="text-xs text-brand-400 mb-0.5">
            {format(now, "EEEE, d MMMM")}
          </p>
          <h1 className="text-2xl font-medium text-brand-900">My bookings</h1>
        </div>
        <Link href="/book" className="btn-primary text-sm">
          Book a court
        </Link>
      </div>

      {/* Stats row */}
      <div className="card px-5 py-4 mb-3 grid grid-cols-3 divide-x divide-brand-100">
        <div className="flex flex-col items-center gap-0.5 pr-4">
          <span className="text-xl font-medium text-brand-900">
            {totalSessions}
          </span>
          <span className="text-xs text-brand-400">Sessions</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-4">
          <span className="text-xl font-medium text-brand-900">
            {totalHours}h
          </span>
          <span className="text-xs text-brand-400">Hours played</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 pl-4">
          <span className="text-xl font-medium text-brand-900">
            €{totalSpent.toFixed(0)}
          </span>
          <span className="text-xs text-brand-400">Total spent</span>
        </div>
      </div>

      {/* Week strip */}
      <div className="card px-5 py-4 mb-7">
        <p className="text-xs text-brand-400 mb-3">This week</p>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(({ day, hasBooking }, i) => {
            const isCurrentDay =
              day.getDate() === now.getDate() &&
              day.getMonth() === now.getMonth();
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    isCurrentDay
                      ? "text-brand-600 font-medium"
                      : "text-brand-300"
                  }`}
                >
                  {DAY_LABELS[i]}
                </span>
                <span
                  className={`text-sm font-medium ${
                    isCurrentDay ? "text-brand-600" : "text-brand-900"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    hasBooking ? "bg-brand-600" : "bg-brand-100"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Next up — hero card */}
      {nextBooking ? (
        <section className="mb-7">
          <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-3">
            Next up
          </h2>
          <NextUpCard booking={nextBooking} statusStyle={STATUS_STYLE} />
        </section>
      ) : (
        <div className="card p-8 text-center mb-7">
          <p className="text-sm text-brand-400 mb-4">No upcoming bookings</p>
          <Link href="/book" className="btn-primary text-sm">
            Book a court
          </Link>
        </div>
      )}

      {/* Rest of upcoming */}
      {restUpcoming.length > 0 && (
        <section className="mb-7">
          <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-3">
            Upcoming
          </h2>
          <div className="flex flex-col gap-2">
            {restUpcoming.map((b) => (
              <UpcomingRow key={b.id} booking={b} statusStyle={STATUS_STYLE} />
            ))}
          </div>
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-3">
            Past
          </h2>
          <div className="flex flex-col gap-2 opacity-60">
            {past.map((b) => (
              <PastRow key={b.id} booking={b} statusStyle={STATUS_STYLE} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Next Up Hero Card ────────────────────────────────────────────────────────

async function NextUpCard({
  booking: b,
  statusStyle,
}: {
  booking: BookingWithJoins;
  statusStyle: Record<string, string>;
}) {
  const name = b.court?.name ?? b.coach?.profile?.full_name ?? "Booking";
  const label = getBookingLabel(b.starts_at);

  async function cancel() {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", b.id)
      .eq("player_id", user.id);
    revalidatePath("/my-bookings");
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 px-5 py-4">
        {/* Date callout */}
        <div className="flex flex-col items-center justify-center bg-brand-50 rounded-xl px-4 py-3 flex-shrink-0 min-w-[56px]">
          <span className="text-2xl font-medium text-brand-600 leading-none">
            {format(new Date(b.starts_at), "d")}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-brand-400 mt-0.5">
            {format(new Date(b.starts_at), "MMM")}
          </span>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-base font-medium text-brand-900 truncate">
              {name}
            </span>
            <span className={statusStyle[b.status] ?? ""}>{b.status}</span>
          </div>
          <p className="text-sm text-brand-400 mb-2.5">
            {format(new Date(b.starts_at), "HH:mm")} · {b.duration_min} min · €
            {b.total_price.toFixed(2)}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-300">
              Ref:{" "}
              <span className="text-brand-500 font-medium">{b.reference}</span>
            </span>
            {label && (
              <>
                <span className="text-brand-200">·</span>
                <span className="text-xs font-medium text-brand-600">
                  {label}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-brand-100 px-5 py-3 flex items-center justify-between">
        <button className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-600 transition-colors">
          <Calendar size={13} />
          Add to calendar
        </button>
        <form action={cancel}>
          <button
            type="submit"
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Cancel booking
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Upcoming Row ─────────────────────────────────────────────────────────────

async function UpcomingRow({
  booking: b,
  statusStyle,
}: {
  booking: BookingWithJoins;
  statusStyle: Record<string, string>;
}) {
  const name = b.court?.name ?? b.coach?.profile?.full_name ?? "Booking";

  async function cancel() {
    "use server";
    const supabase = await createClient();
    await supabase
      .from("bookings")
      .update({ status: "cancelled" } as unknown as never)
      .eq("id", b.id);
    redirect("/my-bookings");
  }

  return (
    <div className="card px-5 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-brand-900 truncate">{name}</p>
          <p className="text-xs text-brand-400 mt-0.5">
            {formatInTimeZone(b.starts_at, "Europe/Skopje", "HH:mm")} ·{" "}
            {b.duration_min} min
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={statusStyle[b.status] ?? ""}>{b.status}</span>
          <span className="text-sm font-medium text-brand-800">
            €{b.total_price.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-brand-100">
        <span className="text-xs text-brand-300">
          Ref: <span className="font-medium text-brand-500">{b.reference}</span>
        </span>
        <form action={cancel}>
          <button
            type="submit"
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Past Row ─────────────────────────────────────────────────────────────────

function PastRow({
  booking: b,
  statusStyle,
}: {
  booking: BookingWithJoins;
  statusStyle: Record<string, string>;
}) {
  const name = b.court?.name ?? b.coach?.profile?.full_name ?? "Booking";

  return (
    <div className="card px-5 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-brand-900 truncate">{name}</p>
          <p className="text-xs text-brand-400 mt-0.5">
            {format(new Date(b.starts_at), "EEE d MMM · HH:mm")} ·{" "}
            {b.duration_min} min
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={statusStyle[b.status] ?? ""}>{b.status}</span>
          <span className="text-sm font-medium text-brand-800">
            €{b.total_price.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-brand-100">
        <span className="text-xs text-brand-300">
          Ref: <span className="font-medium text-brand-500">{b.reference}</span>
        </span>
        <Link
          href="/book"
          className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-600 transition-colors"
        >
          <RotateCcw size={11} />
          Book again
        </Link>
      </div>
    </div>
  );
}
