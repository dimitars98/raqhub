import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clubAccess, PLANS, readOnlyFrom } from "@/lib/plans";
import { clubNow } from "@/lib/automation/time";
import OwnerClient, { type OwnerClub, type OwnerPayment } from "@/components/admin/OwnerClient";

// Only for the app owner (super_admin). Everyone else gets "not found", so
// the page doesn't even show that it exists.
export const dynamic = "force-dynamic";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export default async function OwnerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "super_admin") notFound();

  // This page reads every club with the service-role key. If the deployment
  // doesn't have it, say so instead of crashing the whole page.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const t = await getTranslations("owner.missingKey");
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-ink-900">{t("title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{t("body")}</p>
        <code className="mt-4 inline-block rounded-lg bg-white px-3 py-1.5 font-mono text-sm text-ink-900 ring-1 ring-amber-200">
          SUPABASE_SERVICE_ROLE_KEY
        </code>
        <p className="mt-4 text-sm leading-relaxed text-ink-600">{t("where")}</p>
      </div>
    );
  }

  // Checked above; from here on the service-role key reads every club.
  const db = createAdminClient();
  const since30 = daysAgo(30);

  const [{ data: clubs }, { data: courts }, { data: payments }, users] = await Promise.all([
    db
      .from("clubs")
      .select("id, name, slug, city, country, owner_id, plan, trial_ends_at, paid_until, created_at")
      .order("created_at", { ascending: false }),
    db.from("courts").select("id, club_id").eq("is_active", true),
    db
      .from("club_payments")
      .select("id, club_id, plan, period, method, amount, paid_until, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const courtClub = new Map((courts ?? []).map((c) => [c.id, c.club_id]));
  const courtCount = new Map<string, number>();
  for (const c of courts ?? []) courtCount.set(c.club_id, (courtCount.get(c.club_id) ?? 0) + 1);

  // Bookings in the last 30 days, per club: shows which clubs really use it.
  const { data: recent } = await db
    .from("bookings")
    .select("court_id")
    .gte("starts_at", since30)
    .neq("status", "cancelled")
    .not("court_id", "is", null)
    .limit(20000);
  const bookingCount = new Map<string, number>();
  for (const b of recent ?? []) {
    const clubId = b.court_id ? courtClub.get(b.court_id) : undefined;
    if (clubId) bookingCount.set(clubId, (bookingCount.get(clubId) ?? 0) + 1);
  }

  const accounts = new Map(
    (users.data?.users ?? []).map((u) => [
      u.id,
      { email: u.email ?? null, name: (u.user_metadata?.full_name as string | undefined) ?? null },
    ]),
  );

  const rows: OwnerClub[] = (clubs ?? []).map((c) => {
    const access = clubAccess(c);
    const owner = c.owner_id ? accounts.get(c.owner_id) : undefined;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      country: c.country,
      createdAt: c.created_at,
      plan: access.plan,
      status: access.status,
      readOnlyFrom: access.status === "grace" || access.status === "locked" ? readOnlyFrom(c) : null,
      trialEndsAt: c.trial_ends_at,
      paidUntil: c.paid_until,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      courts: courtCount.get(c.id) ?? 0,
      bookings30: bookingCount.get(c.id) ?? 0,
    };
  });

  const clubName = new Map(rows.map((r) => [r.id, r.name]));
  const paymentRows: OwnerPayment[] = (payments ?? []).map((p) => ({
    id: p.id,
    clubName: clubName.get(p.club_id) ?? "–",
    plan: p.plan,
    period: p.period as OwnerPayment["period"],
    method: p.method as OwnerPayment["method"],
    amount: Number(p.amount),
    paidUntil: p.paid_until,
    createdAt: p.created_at,
  }));

  const thisMonth = clubNow().date.slice(0, 7);
  const stats = {
    clubs: rows.length,
    trial: rows.filter((r) => r.status === "trial").length,
    paying: rows.filter((r) => r.status === "active").length,
    unpaid: rows.filter((r) => r.status === "grace" || r.status === "locked").length,
    // What paying clubs are worth per month, at the monthly price.
    monthly: rows
      .filter((r) => r.status === "active")
      .reduce((sum, r) => sum + PLANS[r.plan].priceMonthly, 0),
    receivedThisMonth: paymentRows
      .filter((p) => clubNow(new Date(p.createdAt)).date.startsWith(thisMonth))
      .reduce((sum, p) => sum + p.amount, 0),
  };

  return <OwnerClient clubs={rows} payments={paymentRows} stats={stats} today={clubNow().date} />;
}
