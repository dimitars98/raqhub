import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Booking, Court, Member, Profile } from "@/types/database";
import { format } from "date-fns";

type CourtWithClub = Court & {
  club?: { name: string; city: string | null } | null;
};

type BookingWithPlayer = Booking & {
  player?: Pick<Profile, "full_name"> | null;
  member?: Pick<Member, "full_name"> | null;
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-brand-100 text-brand-800", // was orange
};

export default async function AdminCourtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single()) as { data: { role: string } | null; error: unknown };

  if (profile?.role !== "club_admin" && profile?.role !== "super_admin") {
    redirect("/");
  }

  const { data: courtData } = await supabase
    .from("courts")
    .select("*, club:clubs(name, city)")
    .eq("id", id)
    .single();

  const court = courtData as CourtWithClub | null;
  if (!court) notFound();

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("*, player:profiles(full_name), member:members(full_name)")
    .eq("court_id", id)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(20);

  const bookings = (bookingsData ?? []) as BookingWithPlayer[];

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2 text-sm text-ink-400 mb-6">
        <Link
          href="/admin/courts"
          className="hover:text-ink-600 transition-colors"
        >
          Courts
        </Link>
        <span>/</span>
        <span className="text-ink-700">{court.name}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-ink-900">{court.name}</h1>
          <p className="text-sm text-ink-400 mt-1">
            {court.club?.name}
            {court.club?.city ? ` · ${court.club.city}` : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            court.is_active
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {court.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="card p-5 mb-8">
        <h2 className="text-sm font-medium text-ink-900 mb-4">Details</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink-400 text-xs">Surface</dt>
            <dd className="text-ink-900 mt-0.5">{court.surface}</dd>
          </div>
          <div>
            <dt className="text-ink-400 text-xs">Type</dt>
            <dd className="text-ink-900 mt-0.5">
              {court.is_indoor ? "Indoor" : "Outdoor"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-400 text-xs">Price</dt>
            <dd className="text-ink-900 mt-0.5">
              €{court.price_per_hour} / hr
            </dd>
          </div>
          {court.description && (
            <div className="col-span-2">
              <dt className="text-ink-400 text-xs">Description</dt>
              <dd className="text-ink-900 mt-0.5">{court.description}</dd>
            </div>
          )}
        </dl>
      </div>

      <h2 className="text-sm font-medium text-ink-900 mb-4">
        Upcoming bookings
      </h2>
      {!bookings.length ? (
        <p className="text-sm text-ink-400">No upcoming bookings.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((b) => {
            const name =
              b.member?.full_name ?? b.player?.full_name ?? "Unknown";
            return (
              <div
                key={b.id}
                className="card px-4 py-3 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900">{name}</div>
                  <div className="text-xs text-ink-400 mt-0.5">
                    {format(new Date(b.starts_at), "EEE d MMM · HH:mm")} —{" "}
                    {format(new Date(b.ends_at), "HH:mm")}
                  </div>
                </div>
                <div className="text-sm font-medium text-ink-800">
                  €{b.total_price}
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[b.status] ?? "bg-brand-100 text-brand-800"}`}
                >
                  {b.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
