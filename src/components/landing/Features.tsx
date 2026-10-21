import { addDays, format } from "date-fns";
import { ArrowUpRight, MapPin, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { BADGE, memberStatusTone } from "@/lib/badges";
import { dateLocale } from "@/lib/dateLocale";
import { makeLabels, SPORT_EMOJI } from "@/lib/labels";

// The four big feature rows, numbered like a tennis game: 15 → 30 → 40 →
// Game. Each panel copies a real screen in the app — same texts, colours and
// layout, only smaller. The club and people in them are a made-up example.

const CLUB = "Riverside Tennis Club";

const rows = [
  { id: "bookings", score: "15" },
  { id: "membership", score: "30" },
  { id: "coaching", score: "40" },
  { id: "analytics", score: "Game" },
] as const;

type RowId = (typeof rows)[number]["id"];

const HIGHLIGHT =
  "box-decoration-clone bg-[linear-gradient(transparent_58%,#d6f09a_58%,#d6f09a_92%,transparent_92%)] px-1 -mx-1";

/** Text side of a row: scoreboard chip, title, body and points. */
function FeatureCopy({ id, children }: { id: RowId; children?: React.ReactNode }) {
  const t = useTranslations(`features.rows.${id}`);
  const score = rows.find((r) => r.id === id)!.score;
  const points = t.raw("points") as string[];
  return (
    <div className="min-w-0">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-md bg-[#111c0a] px-2.5 py-1.5 font-display text-[13px] font-extrabold leading-none tabular-nums text-[#a8d832]">
          {score}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#3d4f35]">{t("label")}</span>
      </div>

      <h2 className="mb-5 font-display text-[32px] font-extrabold leading-[1.05] tracking-tight text-[#111c0a] text-balance sm:text-[38px] lg:text-[46px]">
        {t("pre")}
        <span className={HIGHLIGHT}>{t("mark")}</span>
        {t("post")}
      </h2>

      <p className="mb-8 max-w-[52ch] text-[16px] leading-relaxed text-[#55664c]">{t("body")}</p>

      {/* Points laid out like court lines: ruled rows, two-up from sm */}
      <ul className="grid grid-cols-1 border-b border-[#e8ede4] sm:grid-cols-2 sm:gap-x-8">
        {points.map((p) => (
          <li
            key={p}
            className="flex items-center gap-3 border-t border-[#e8ede4] py-3.5 text-[14px] font-medium text-[#1e3010]"
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-[#a8d832] ring-4 ring-[#f3fbde]" />
            {p}
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

/* ── 15 · Timetable — the admin day view, courts side by side ─────────────── */

// Same colours as the real timetable: bookings are coloured by status.
type Status = "confirmed" | "completed" | "pending" | "cancelled";
const STATUS: Record<Status, { wrap: string; dot: string; name: string; time: string }> = {
  confirmed: { wrap: "bg-[#e4f7b8] border-l-[#7aad12]", dot: "bg-[#7aad12]", name: "text-[#2e4d03]", time: "text-[#4d7a08]" },
  completed: { wrap: "bg-[#e8ede4] border-l-[#3d4f35]", dot: "bg-[#3d4f35]", name: "text-[#111c0a]", time: "text-[#1e3010]" },
  pending: { wrap: "bg-[#e8f4fd] border-l-[#378add]", dot: "bg-[#378add]", name: "text-[#0c4478]", time: "text-[#1a5ea8]" },
  cancelled: { wrap: "bg-[#f4f6f2] border-l-[#6e7f65]", dot: "bg-[#6e7f65]", name: "text-[#3d4f35]", time: "text-[#6e7f65]" },
};

const SLOT_PX = 30; // one half hour
const FIRST_HOUR = 17;
const HALF_SLOTS = [17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5];
const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;

type Block = { col: number; start: number; end: number; status: Status; who: string; coach?: string };
const BLOCKS: Block[] = [
  { col: 0, start: 17, end: 18, status: "confirmed", who: "Emma Lewis" },
  { col: 0, start: 18.5, end: 19.5, status: "confirmed", who: "Tom" },
  { col: 1, start: 18, end: 19.5, status: "confirmed", who: "Mia Schmidt", coach: "Daniel Weber" },
  { col: 1, start: 20, end: 21, status: "pending", who: "Lucas Martin" },
  { col: 2, start: 18, end: 20, status: "confirmed", who: "Sofia Rossi" },
];

function TimetablePanel() {
  const t = useTranslations("features.mock");
  const tt = useTranslations("timetable");
  const labels = makeLabels(useTranslations("labels"));
  const df = dateLocale(useLocale());
  const today = format(new Date(), "EEEE, d MMMM yyyy", { locale: df });

  const courts = [
    { name: t("court", { n: 1 }), sub: [labels.sport("tennis"), labels.surface("clay"), labels.inOut(false)] },
    { name: t("court", { n: 2 }), sub: [labels.sport("padel"), labels.surface("artificial_grass"), labels.inOut(false)] },
    { name: t("court", { n: 3 }), sub: [labels.sport("tennis"), labels.surface("hard"), labels.inOut(true)] },
  ];
  const cols = "grid-cols-[50px_repeat(3,minmax(0,1fr))] sm:grid-cols-[58px_repeat(3,minmax(0,1fr))]";

  return (
    <div className="min-w-0 rounded-3xl border border-[#e8ede4] bg-[#f8f9f7] p-3 shadow-[0_30px_60px_-40px_rgba(17,28,10,0.35)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-[17px] font-semibold text-[#111c0a]">{tt("title")}</div>
          <div className="truncate text-[12px] text-[#6e7f65] first-letter:uppercase">{today}</div>
        </div>
        <div aria-hidden className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-lg bg-[#7aad12] px-3 py-1.5 text-[12px] font-medium text-white">{tt("today")}</span>
          <span className="grid size-[30px] place-items-center rounded-lg border border-[#d0d9c9] bg-white text-[16px] text-[#3d4f35]">‹</span>
          <span className="grid size-[30px] place-items-center rounded-lg border border-[#d0d9c9] bg-white text-[16px] text-[#3d4f35]">›</span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
        {(Object.keys(STATUS) as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-[11px] text-[#3d4f35]">
            <span className={`size-2.5 rounded-[3px] opacity-80 ${STATUS[s].dot}`} />
            {labels.bookingStatus(s)}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e8ede4] bg-white">
        <div className={`grid border-b border-[#e8ede4] ${cols}`}>
          <div className="bg-[#f4f6f2]" />
          {courts.map((c) => (
            <div key={c.name} className="min-w-0 border-l border-[#e8ede4] px-1.5 py-3 text-center">
              <div className="truncate text-[14px] font-semibold text-[#1a5ea8]">{c.name}</div>
              <div className="mt-0.5 truncate text-[11px] text-[#6e7f65]">{c.sub.join(" · ")}</div>
            </div>
          ))}
        </div>

        <div className={`relative grid ${cols}`}>
          <div className="border-r border-[#e8ede4] bg-[#f4f6f2]">
            {HALF_SLOTS.map((h) => (
              <div
                key={h}
                className={`box-border border-b border-[#e8ede4] px-2 pt-1 text-[11px] last:border-0 sm:px-2.5 ${
                  h % 1 ? "text-[#6e7f65]" : "font-medium text-[#3d4f35]"
                }`}
                style={{ height: SLOT_PX }}
              >
                {hhmm(h)}
              </div>
            ))}
          </div>
          {courts.map((c, col) => (
            <div
              key={c.name}
              className="relative min-w-0 border-l border-[#e8ede4] bg-[repeating-linear-gradient(to_bottom,transparent_0_29px,#e8ede4_29px_30px)]"
              style={{ height: HALF_SLOTS.length * SLOT_PX }}
            >
              {BLOCKS.filter((b) => b.col === col).map((b) => {
                const s = STATUS[b.status];
                const height = (b.end - b.start) * 2 * SLOT_PX - 4;
                return (
                  <div
                    key={b.who}
                    className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-2 py-1.5 sm:px-2.5 ${s.wrap}`}
                    style={{ top: (b.start - FIRST_HOUR) * 2 * SLOT_PX + 2, height }}
                  >
                    <div className={`truncate text-[12px] font-semibold sm:text-[13px] ${s.name}`}>{b.who}</div>
                    {b.coach && (
                      <div className={`truncate text-[11px] font-medium ${s.time}`}>{tt("lessonWith", { coach: b.coach })}</div>
                    )}
                    {height > (b.coach ? 56 : 36) && (
                      <div className={`mt-[3px] truncate text-[11px] ${s.time}`}>
                        {hhmm(b.start)} – {hhmm(b.end)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {/* Now line, as on the real timetable */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 h-0.5 bg-[#7aad12]" style={{ top: (17.75 - FIRST_HOUR) * 2 * SLOT_PX }}>
            <span className="absolute -top-1 left-[45px] size-2.5 rounded-full bg-[#7aad12] sm:left-[53px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 30 · Membership — the members list, and what a member sees ─────────── */

function MembershipPanel() {
  const t = useTranslations("features.mock");
  const tm = useTranslations("members");
  const tp = useTranslations("membershipPage");
  const labels = makeLabels(useTranslations("labels"));
  const locale = useLocale();
  const df = dateLocale(locale);
  const now = new Date();
  const date = (d: Date) => format(d, "d MMM yyyy", { locale: df });

  const gold = { name: t("gold"), price: 300, period: "annual" };
  const juniors = { name: t("juniors"), price: 25, period: "monthly" };
  const members = [
    { id: "olivia-reed", name: "Olivia Reed", plan: gold, status: "active", ends: addDays(now, 12) },
    { id: "lucas-martin", name: "Lucas Martin", plan: juniors, status: "active", ends: addDays(now, 23) },
    { id: "noah-klein", name: "Noah Klein", plan: gold, status: "expired", ends: addDays(now, -9) },
  ] as const;
  const price = (p: { price: number; period: string }) => `€${p.price} ${labels.billingPeriod(p.period)}`;
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-[#6e7f65] sm:px-4";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="overflow-hidden rounded-3xl border border-[#e8ede4] bg-white shadow-[0_30px_60px_-40px_rgba(17,28,10,0.35)]">
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div>
            <div className="text-[17px] font-semibold text-[#111c0a]">{tm("title")}</div>
            <div className="text-[12px] text-[#6e7f65]">{tm("total", { count: members.length })}</div>
          </div>
          <span aria-hidden className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#111c0a] px-4 py-2 text-[12px] font-medium text-white">
            <Plus size={14} />
            {tm("addMember")}
          </span>
        </div>
        <table className="w-full table-fixed border-t border-[#e8ede4] text-[13px]">
          <thead className="bg-[#f8f9f7]">
            <tr>
              <th className={`${th} w-[38%]`}>{tm("columns.name")}</th>
              <th className={`${th} hidden sm:table-cell`}>{tm("columns.plan")}</th>
              <th className={th}>{tm("columns.status")}</th>
              <th className={th}>{tm("columns.expires")}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-[#e8ede4]">
                <td className="px-3 py-3 sm:px-4">
                  <div className="truncate font-medium text-[#111c0a]">{m.name}</div>
                  <div className="truncate text-[11px] text-[#6e7f65] sm:hidden">{m.plan.name}</div>
                </td>
                <td className="hidden px-3 py-3 sm:table-cell sm:px-4">
                  <div className="truncate text-[#3d4f35]">{m.plan.name}</div>
                  <div className="truncate text-[11px] text-[#6e7f65]">{price(m.plan)}</div>
                </td>
                <td className="px-3 py-3 sm:px-4">
                  <span className={`${BADGE} ${memberStatusTone(m.status)}`}>{labels.memberStatus(m.status)}</span>
                </td>
                <td className="px-3 py-3 text-[12px] text-[#3d4f35] sm:px-4">{date(m.ends)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* What Olivia sees on her Membership page */}
      <div className="rounded-3xl border border-[#e8ede4] bg-[#f8f9f7] p-4 sm:ml-auto sm:w-[300px]">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[#6e7f65]">{tp("yourPlan")}</div>
        <div className="card p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-[14px] font-medium text-[#2e4d03]">{gold.name}</div>
              <div className="mt-0.5 text-[12px] text-[#6e7f65]">{price(gold)}</div>
            </div>
            <span className={`${BADGE} ${memberStatusTone("active")}`}>{labels.memberStatus("active")}</span>
          </div>
          <div className={`${BADGE} mb-3 bg-brand-100 text-brand-800`}>{tp("discountEvery", { pct: 20 })}</div>
          <div className="border-t border-brand-100 pt-3 text-[12px] text-brand-800">
            {tp("expires", { date: date(members[0].ends) })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 40 · Coaching — the coach's page and the lesson booking form ─────────── */

const LESSON_HOURS = [9, 10, 11, 12, 14, 15, 16, 17];
const TAKEN = [10, 15];
const PICKED = 11;

function CoachPanel() {
  const t = useTranslations("features.mock");
  const tc = useTranslations("coachBooking");
  const labels = makeLabels(useTranslations("labels"));

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-3xl border border-[#e3eed3] bg-[#f3f8ec] p-3 sm:p-5">
      <div className="card p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <Avatar id="daniel-weber" name="Daniel Weber" className="size-14 text-base" />
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-semibold leading-tight tracking-tight text-[#111c0a]">Daniel Weber</div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[#3d4f35]">
              <MapPin size={12} className="shrink-0 text-[#6e7f65]" aria-hidden />
              <span className="truncate">{CLUB}</span>
            </div>
          </div>
          <div className="shrink-0 text-[18px] font-bold tracking-tight text-[#111c0a]">
            €25<span className="text-[12px] font-normal tracking-normal text-[#3d4f35]"> {tc("perHour")}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 sm:pl-[72px]">
          {(["beginner", "junior", "advanced"] as const).map((l) => (
            <span key={l} className="badge-brand">
              {labels.level(l)}
            </span>
          ))}
          {[t("specServe"), t("specFootwork")].map((s) => (
            <span key={s} className="badge bg-ink-50 text-ink-800">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="mb-4 text-[15px] font-semibold text-[#111c0a]">{tc("bookTitle")}</div>
        <div className="mb-2 text-[11px] font-medium text-[#3d4f35]">{tc("startTime")}</div>
        <div className="mb-4 grid grid-cols-4 gap-1.5">
          {LESSON_HOURS.map((h) => {
            const taken = TAKEN.includes(h);
            const active = h === PICKED;
            return (
              <span
                key={h}
                className={`rounded-lg border py-1.5 text-center text-[12px] ${
                  taken
                    ? "border-ink-100 bg-ink-50 text-ink-200 line-through"
                    : active
                      ? "border-brand-600 bg-brand-600 font-medium text-white"
                      : "border-ink-200 text-ink-800"
                }`}
              >
                {hhmm(h)}
              </span>
            );
          })}
        </div>
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50 px-3.5 py-2.5">
          <span className="truncate text-[12px] text-[#3d4f35]">
            {tc("minutes", { n: 60 })} · Daniel Weber
          </span>
          <span className="text-[14px] font-semibold text-[#111c0a]">€25.00</span>
        </div>
        <span aria-hidden className="flex w-full justify-center rounded-full bg-[#111c0a] py-2.5 text-[13px] font-medium text-white">
          {tc("confirm")}
        </span>
      </div>
    </div>
  );
}

/* ── Game · Analytics — peak hours and revenue by sport ───────────────────── */

// Example bookings per hour, Mon → Sun, 07:00 → 21:00 (the real heatmap's range).
const PEAK = [
  [0, 1, 1, 0, 1, 0, 1, 1, 2, 3, 5, 7, 8, 6, 3],
  [1, 1, 0, 1, 0, 1, 1, 2, 2, 4, 6, 8, 9, 7, 3],
  [0, 1, 1, 1, 1, 0, 1, 1, 3, 4, 5, 7, 7, 5, 2],
  [1, 0, 1, 0, 1, 1, 1, 2, 3, 5, 7, 9, 9, 6, 4],
  [0, 1, 1, 1, 2, 1, 2, 2, 3, 4, 5, 6, 5, 3, 1],
  [2, 4, 6, 8, 8, 7, 6, 5, 4, 3, 3, 2, 2, 1, 0],
  [1, 3, 5, 7, 7, 6, 5, 4, 3, 2, 2, 1, 1, 0, 0],
];
const PEAK_MAX = Math.max(...PEAK.flat());
const SPORT_HEX = { tennis: "#7aad12", padel: "#378add", pickleball: "#f59e0b" } as const;
const SPORT_REVENUE = [
  { sport: "tennis", revenue: 4820 },
  { sport: "padel", revenue: 2960 },
  { sport: "pickleball", revenue: 640 },
] as const;

function AnalyticsPanel() {
  const t = useTranslations("analytics");
  const labels = makeLabels(useTranslations("labels"));
  const days = t.raw("daysShort") as string[];
  const top = SPORT_REVENUE[0].revenue;

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-3xl border border-[#e8ede4] bg-[#f8f9f7] p-3 shadow-[0_30px_60px_-40px_rgba(17,28,10,0.35)] sm:p-5">
      <div className="rounded-2xl border border-[#e8ede4] bg-white p-4 sm:p-5">
        <div className="mb-4">
          <div className="text-[14px] font-semibold text-[#111c0a]">{t("peakHours")}</div>
          <div className="mt-0.5 text-[12px] text-[#6e7f65]">{t("bookingFrequencyByDayAnd")}</div>
        </div>
        <div aria-hidden>
          <div className="mb-1 ml-9 flex">
            {PEAK[0].map((_, i) => (
              <div key={i} className="flex-1 text-center text-[9px] text-[#6e7f65]">
                {i % 2 === 0 ? `${i + 7}h` : ""}
              </div>
            ))}
          </div>
          {PEAK.map((row, d) => (
            <div key={d} className="mb-0.5 flex items-center">
              <div className="w-9 shrink-0 truncate text-[10px] text-[#6e7f65]">{days[d]}</div>
              {row.map((v, h) => {
                const k = v / PEAK_MAX;
                return (
                  <div
                    key={h}
                    className="mx-[1px] flex h-6 flex-1 items-center justify-center rounded-sm"
                    style={{ background: v === 0 ? "#f4f6f2" : `rgba(122, 173, 18, ${0.1 + k * 0.9})` }}
                  >
                    {k > 0.5 && <span className="text-[8px] font-bold text-white">{v}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="mt-3 ml-9 flex items-center gap-2">
            <span className="text-[9px] text-[#6e7f65]">{t("low")}</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
              <div key={o} className="h-3 w-4 rounded-sm" style={{ background: `rgba(122, 173, 18, ${o})` }} />
            ))}
            <span className="text-[9px] text-[#6e7f65]">{t("high")}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e8ede4] bg-white p-4 sm:p-5">
        <div className="mb-4">
          <div className="text-[14px] font-semibold text-[#111c0a]">{t("revenueBySport")}</div>
          <div className="mt-0.5 text-[12px] text-[#6e7f65]">{t("allTime")}</div>
        </div>
        <div className="flex flex-col gap-2.5">
          {SPORT_REVENUE.map((s) => (
            <div key={s.sport} className="flex items-center gap-3 text-[12px]">
              <span className="w-[92px] shrink-0 truncate text-[#3d4f35]">
                {SPORT_EMOJI[s.sport]} {labels.sport(s.sport)}
              </span>
              <span className="h-5 flex-1">
                <span
                  className="block h-full rounded-r-md"
                  style={{ width: `${(s.revenue / top) * 100}%`, background: SPORT_HEX[s.sport] }}
                />
              </span>
              <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-[#111c0a]">€{s.revenue}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Section ───────────────────────────────────────────────────────────── */

/** The one call to action, at the end — same ball-and-arrow pill as elsewhere. */
function StartLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group/btn mt-8 inline-flex w-fit items-center gap-3 rounded-full border border-[#111c0a] bg-[#111c0a] py-1.5 pl-5 pr-1.5 text-sm font-semibold text-white transition-[background-color,border-color,color,transform] duration-300 ease-out hover:border-[#a8d832] hover:bg-[#a8d832] hover:text-[#111c0a] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7aad12] motion-reduce:transition-none"
    >
      {label}
      <span
        aria-hidden
        className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#a8d832] text-[#111c0a] transition-colors duration-300 ease-out before:absolute before:inset-y-0 before:-left-[64%] before:w-full before:rounded-full before:border-[1.5px] before:border-current before:opacity-20 after:absolute after:inset-y-0 after:-right-[64%] after:w-full after:rounded-full after:border-[1.5px] after:border-current after:opacity-20 group-hover/btn:bg-[#111c0a] group-hover/btn:text-[#a8d832] motion-reduce:transition-none"
      >
        <ArrowUpRight
          size={16}
          strokeWidth={2.5}
          className="relative z-10 transition-transform duration-300 ease-out group-hover/btn:translate-x-[160%] group-hover/btn:-translate-y-[160%] motion-reduce:transition-none"
        />
        <ArrowUpRight
          size={16}
          strokeWidth={2.5}
          className="absolute z-10 -translate-x-[160%] translate-y-[160%] transition-transform duration-300 ease-out group-hover/btn:translate-x-0 group-hover/btn:translate-y-0 motion-reduce:transition-none"
        />
      </span>
    </Link>
  );
}

const ROW = "grid grid-cols-1 items-center gap-10 py-14 lg:grid-cols-2 lg:gap-20 lg:py-24";

export default function Features() {
  const locale = useLocale();
  const t = useTranslations("features");
  return (
    <section id="features" className="relative overflow-hidden">
      <div className="mx-auto max-w-[1180px] px-6 py-4 lg:px-10 lg:py-10">
        <div className={`${ROW} border-b border-[#e8ede4]`}>
          <FeatureCopy id="bookings" />
          <TimetablePanel />
        </div>

        {/* Flipped on desktop; text first on phones */}
        <div className={`${ROW} border-b border-[#e8ede4]`}>
          <div className="order-last lg:order-none">
            <MembershipPanel />
          </div>
          <FeatureCopy id="membership" />
        </div>

        <div className={`${ROW} border-b border-[#e8ede4]`}>
          <FeatureCopy id="coaching" />
          <CoachPanel />
        </div>

        <div className={ROW}>
          <div className="order-last lg:order-none">
            <AnalyticsPanel />
          </div>
          <FeatureCopy id="analytics">
            <StartLink href={`/${locale}/signup?role=admin`} label={t("cta")} />
          </FeatureCopy>
        </div>
      </div>
    </section>
  );
}
