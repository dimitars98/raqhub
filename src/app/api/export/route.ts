import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";
import { CLUB_TIME_ZONE } from "@/lib/automation/time";
import { makeLabels } from "@/lib/labels";
import { toCsv } from "@/lib/csv";

// Settings → Your data: the club owner downloads their bookings or members
// as a spreadsheet. Everything is read with the owner's own session, so the
// database rules decide what they can see.
//
//   GET /api/export?type=bookings
//   GET /api/export?type=members

const PAGE = 1000; // Supabase returns at most 1000 rows per request

/** Reads every row of a query, a page at a time. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await page(from, from + PAGE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLUB_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLUB_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const day = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "");
const time = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : "");

type BookingRow = {
  reference: string;
  starts_at: string;
  ends_at: string;
  duration_min: number;
  status: string;
  total_price: number;
  walk_in_name: string | null;
  notes: string | null;
  court: { name: string } | null;
  member: { full_name: string } | null;
  player: { full_name: string | null } | null;
  coach: { profile: { full_name: string | null } | null } | null;
};

type MemberRow = {
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
  plan: { name: string } | null;
};

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type");
  if (type !== "bookings" && type !== "members") {
    return NextResponse.json({ error: "Unknown export" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: club } = await supabase
    .from("clubs")
    .select("id, slug")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!club) return NextResponse.json({ error: "No club found" }, { status: 403 });

  // Column names in the owner's language.
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale = (routing.locales as readonly string[]).includes(cookieLocale ?? "")
    ? cookieLocale!
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "export" });
  const labels = makeLabels(await getTranslations({ locale, namespace: "labels" }));

  let csv: string;
  if (type === "bookings") {
    // Court bookings are found by court, lessons by coach (they may have no court).
    const [{ data: courts }, { data: coaches }] = await Promise.all([
      supabase.from("courts").select("id").eq("club_id", club.id),
      supabase.from("coaches").select("id").eq("club_id", club.id),
    ]);
    const courtIds = (courts ?? []).map((c) => c.id);
    const coachIds = (coaches ?? []).map((c) => c.id);
    const filters = [
      courtIds.length ? `court_id.in.(${courtIds.join(",")})` : null,
      coachIds.length ? `coach_id.in.(${coachIds.join(",")})` : null,
    ].filter(Boolean);

    const rows = filters.length
      ? await readAll<BookingRow>((from, to) =>
          supabase
            .from("bookings")
            .select(
              "reference, starts_at, ends_at, duration_min, status, total_price, walk_in_name, notes, court:courts(name), member:members(full_name), player:profiles(full_name), coach:coaches(profile:profiles(full_name))",
            )
            .or(filters.join(","))
            .order("starts_at", { ascending: false })
            .range(from, to)
            .returns<BookingRow[]>(),
        )
      : [];

    csv = toCsv(
      [
        t("reference"),
        t("date"),
        t("start"),
        t("end"),
        t("minutes"),
        t("court"),
        t("coach"),
        t("player"),
        t("status"),
        t("price"),
        t("notes"),
      ],
      rows.map((b) => [
        b.reference,
        day(b.starts_at),
        time(b.starts_at),
        time(b.ends_at),
        b.duration_min,
        b.court?.name,
        b.coach?.profile?.full_name,
        b.player?.full_name ?? b.member?.full_name ?? b.walk_in_name,
        labels.bookingStatus(b.status),
        b.total_price,
        b.notes,
      ]),
    );
  } else {
    const rows = await readAll<MemberRow>((from, to) =>
      supabase
        .from("members")
        .select("full_name, email, phone, status, starts_at, ends_at, notes, plan:membership_plans(name)")
        .eq("club_id", club.id)
        .order("full_name")
        .range(from, to)
        .returns<MemberRow[]>(),
    );

    csv = toCsv(
      [t("name"), t("email"), t("phone"), t("plan"), t("status"), t("memberSince"), t("ends"), t("notes")],
      rows.map((m) => [
        m.full_name,
        m.email,
        m.phone,
        m.plan?.name,
        labels.memberStatus(m.status),
        m.starts_at?.slice(0, 10),
        m.ends_at?.slice(0, 10),
        m.notes,
      ]),
    );
  }

  const today = dateFmt.format(new Date());
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${club.slug}-${type}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
