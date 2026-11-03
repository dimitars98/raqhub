import { addDays, format } from "date-fns";
import { ArrowUpRight, Ban, Check, Download, MapPin, Plus, Search, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { BADGE, memberStatusTone } from "@/lib/badges";
import { dateLocale } from "@/lib/dateLocale";
import { makeLabels } from "@/lib/labels";
import SportIcon from "@/components/ui/SportIcon";
import { courtColor, swatchStyle } from "@/lib/courtColors";

// The five big feature rows, numbered like a tennis game: 15 → 30 → 40 →
// Ad → Game. Each panel copies a real screen in the app — same texts, colours and
// layout, only smaller. The club and people in them are a made-up example.

const CLUB = "Larkspur Tennis Club";

const rows = [
  { id: "bookings", score: "15" },
  { id: "membership", score: "30" },
  { id: "coaching", score: "40" },
  { id: "compete", score: "Ad" },
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

// Same colours as the real timetable (TimetableClient's TONES): bookings are
// coloured by what they are, pending ones get a dashed border.
type Kind = "booking" | "lesson" | "group" | "match";
const TONES: Record<Kind, { bg: string; bar: string; name: string; meta: string; av: string; avText: string }> = {
  booking: { bg: "#f1f9dc", bar: "#a8d832", name: "#1e3010", meta: "#4d7a08", av: "#d6f09a", avText: "#2e4d03" },
  lesson: { bg: "#eaf4fd", bar: "#378add", name: "#0c4478", meta: "#1a5ea8", av: "#c0ddf7", avText: "#0c4478" },
  group: { bg: "#111c0a", bar: "#a8d832", name: "#ffffff", meta: "#d6f09a", av: "#2e4d03", avText: "#d6f09a" },
  match: { bg: "#fdf5df", bar: "#e0a400", name: "#5c4000", meta: "#7a5600", av: "#f7e2a6", avText: "#5c4000" },
};
const CLOSED_BG = {
  backgroundColor: "#f3f5f0",
  backgroundImage: "repeating-linear-gradient(135deg, rgba(110,127,101,0.16) 0 6px, transparent 6px 12px)",
};

const HOUR_PX = 56;
const FIRST_HOUR = 17;
const LAST_HOUR = 21;
const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
const initialsOf = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

type Block = { col: number; start: number; end: number; kind: Kind; who: string; tag: "member" | "online" | "pending" | "lesson" | "group" | "match" };
const BLOCKS: Block[] = [
  { col: 0, start: 17, end: 18, kind: "booking", who: "Emma Lewis", tag: "member" },
  { col: 0, start: 18.5, end: 20, kind: "group", who: "Juniors", tag: "group" },
  { col: 1, start: 17, end: 18.5, kind: "match", who: "Marko Petrov", tag: "match" },
  { col: 1, start: 19, end: 20, kind: "booking", who: "Lucas Martin", tag: "pending" },
  { col: 2, start: 18, end: 19, kind: "lesson", who: "Mia Schmidt", tag: "lesson" },
];
/** Court 3 is closed for repairs from 19:00. */
const CLOSED = { col: 2, start: 19, end: 21 };

function TimetablePanel() {
  const t = useTranslations("features.mock");
  const tt = useTranslations("timetable");
  const tcl = useTranslations("closures");
  const labels = makeLabels(useTranslations("labels"));
  const df = dateLocale(useLocale());
  const now = new Date();
  const week = Array.from({ length: 7 }, (_, i) => addDays(now, i - 1));
  const weekPct = [64, 48, 71, 55, 88, 92, 40];
  const coach = "Daniel Weber";

  const courts = [
    { name: t("court", { n: 1 }), sport: "tennis", surface: "clay", indoor: false, pct: 63 },
    { name: `${labels.sport("padel")} 1`, sport: "padel", surface: "artificial_grass", indoor: false, pct: 50 },
    { name: t("court", { n: 3 }), sport: "tennis", surface: "hard", indoor: true, pct: 25 },
  ] as const;

  const tagOf = (b: Block) =>
    b.tag === "member"
      ? tt("tags.member")
      : b.tag === "online"
        ? tt("tags.online")
        : b.tag === "pending"
          ? tt("tags.pending")
          : b.tag === "lesson"
            ? tt("lessonWith", { coach })
            : b.tag === "group"
              ? `${tt("group")} · ${tt("groupWith", { coach })}`
              : tt("tags.match", { taken: 3, max: 4 });

  const legend: [string, React.CSSProperties][] = [
    [tt("legend.booking"), { background: TONES.booking.bar }],
    [tt("legend.lesson"), { background: TONES.lesson.bar }],
    [tt("group"), { background: "#111c0a" }],
    [tt("legend.match"), { background: TONES.match.bar }],
    [tt("tags.pending"), { border: "1.5px dashed #6e7f65" }],
    [tcl("closed"), { ...CLOSED_BG, border: "1px solid #c9d2c2" }],
  ];
  const cols = { gridTemplateColumns: "44px repeat(3, minmax(0, 1fr))" };

  return (
    <div aria-hidden className="flex min-w-0 flex-col gap-3.5 rounded-3xl border border-[#e8ede4] bg-[#f8f9f7] p-3 shadow-[0_30px_60px_-40px_rgba(17,28,10,0.35)] sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-[19px] font-extrabold tracking-tight text-[#111c0a] first-letter:uppercase">
            {format(now, "EEEE, d MMMM", { locale: df })}
          </div>
          <div className="mt-0.5 text-[12px] text-[#3d4f35]">{tt("summary", { n: 5, pct: 46, revenue: "€124" })}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden h-8 items-center gap-1 rounded-[10px] border border-[#d0d9c9] bg-white px-2.5 text-[12px] font-medium text-[#3d4f35] sm:inline-flex">
            <Ban size={12} />
            {tcl("button")}
          </span>
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-[#111c0a] px-3 text-[12px] font-semibold text-white">
            <Plus size={13} />
            {tt("addBooking")}
          </span>
        </div>
      </div>

      {/* Week strip */}
      <div className="flex gap-1.5">
        {week.map((d, i) => {
          const on = i === 1;
          return (
            <div
              key={i}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl border px-1 py-1.5 ${
                i > 4 ? "hidden sm:flex" : ""
              } ${on ? "border-[#111c0a] bg-[#111c0a] text-white" : "border-[#e8ede4] bg-white text-[#111c0a]"}`}
            >
              <span className={`max-w-full truncate text-[9px] font-semibold uppercase tracking-wider ${on ? "text-white/70" : "text-[#6e7f65]"}`}>
                {on ? tt("today") : format(d, "EEE", { locale: df })}
              </span>
              <span className="text-[15px] font-bold leading-tight">{format(d, "d")}</span>
              <span className={`block h-1 w-7 overflow-hidden rounded-full ${on ? "bg-white/20" : "bg-[#eef1ea]"}`}>
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${weekPct[i]}%`, background: weekPct[i] > 85 ? "#e0a400" : "#a8d832" }}
                />
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 px-1 text-[11px] text-[#3d4f35]">
        {legend.map(([label, style]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={style} />
            {label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-[18px] border border-[#e8ede4] bg-white">
        <div className="grid border-b border-[#e8ede4]" style={cols}>
          <div />
          {courts.map((c) => (
            <div key={c.name} className="flex min-w-0 items-center gap-2 border-l border-[#f0f3ec] px-2 py-2.5">
              <span
                className="size-5 shrink-0 rounded-md ring-2 ring-inset ring-white/50"
                style={swatchStyle(courtColor({ sport: c.sport, surface: c.surface }))}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[12px] font-bold text-[#111c0a]">{c.name}</span>
                <span className="truncate text-[10px] text-[#6e7f65]">
                  {labels.surface(c.surface)} · {labels.inOut(c.indoor)}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="relative grid" style={cols}>
          <div className="relative" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}>
            {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
              <span
                key={i}
                className="absolute right-1.5 bg-white px-0.5 text-[10px] font-medium text-[#6e7f65]"
                style={{ top: i === 0 ? 4 : i * HOUR_PX - 7 }}
              >
                {hhmm(FIRST_HOUR + i)}
              </span>
            ))}
          </div>
          {courts.map((c, col) => (
            <div
              key={c.name}
              className="relative min-w-0 border-l border-[#f0f3ec]"
              style={{
                height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX,
                backgroundImage: "linear-gradient(#eef1ea 1px, transparent 1px), linear-gradient(#f6f8f3 1px, transparent 1px)",
                backgroundSize: `100% ${HOUR_PX}px, 100% ${HOUR_PX / 2}px`,
              }}
            >
              {CLOSED.col === col && (
                <div
                  className="absolute inset-x-0 flex justify-center pt-3"
                  style={{ top: (CLOSED.start - FIRST_HOUR) * HOUR_PX, height: (CLOSED.end - CLOSED.start) * HOUR_PX, ...CLOSED_BG }}
                >
                  <span className="h-fit max-w-[92%] truncate rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-[#3d4f35] shadow-sm">
                    {tcl("closed")} · {tcl("reasons.maintenance")}
                  </span>
                </div>
              )}
              {BLOCKS.filter((b) => b.col === col).map((b) => {
                const tone = TONES[b.kind];
                const height = (b.end - b.start) * HOUR_PX - 6;
                return (
                  <div
                    key={b.who}
                    className="absolute inset-x-1 flex flex-col gap-0.5 overflow-hidden rounded-[10px] px-2 py-1.5"
                    style={{
                      top: (b.start - FIRST_HOUR) * HOUR_PX + 3,
                      height,
                      background: tone.bg,
                      border: b.tag === "pending" ? "1.5px dashed #6e7f65" : "0",
                      boxShadow: `inset 4px 0 0 ${tone.bar}`,
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-1">
                      <span
                        className="grid size-4 shrink-0 place-items-center rounded-full text-[7px] font-bold"
                        style={{ background: tone.av, color: tone.avText }}
                      >
                        {b.kind === "group" ? "GR" : initialsOf(b.who)}
                      </span>
                      <span className="min-w-0 truncate text-[11px] font-bold" style={{ color: tone.name }}>
                        {b.who}
                      </span>
                    </span>
                    {height >= 44 && (
                      <span className="truncate text-[10px] font-medium" style={{ color: tone.meta }}>
                        {hhmm(b.start)}–{hhmm(b.end)} · {tagOf(b)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {/* Now line, as on the real timetable */}
          <div className="pointer-events-none absolute inset-x-0 z-[3] border-t-2 border-[#7aad12]" style={{ top: (17.75 - FIRST_HOUR) * HOUR_PX }}>
            <span className="absolute -top-[10px] left-1 rounded-full bg-[#7aad12] px-1 py-px text-[9px] font-bold text-white">17:45</span>
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
    { id: "olivia-reed", name: "Olivia Reed", email: "olivia.reed@mail.com", plan: gold, status: "active", days: 12 },
    { id: "lucas-martin", name: "Lucas Martin", email: "lucas.m@mail.com", plan: juniors, status: "active", days: 64 },
    { id: "noah-klein", name: "Noah Klein", email: "noah.klein@mail.com", plan: gold, status: "expired", days: -9 },
  ] as const;
  const price = (p: { price: number; period: string }) => `€${p.price} ${labels.billingPeriod(p.period)}`;
  const tabs = [
    { key: "all", n: 128 },
    { key: "active", n: 112 },
    { key: "ending", n: 6 },
    { key: "expired", n: 10 },
  ] as const;
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-[#55664c]";

  return (
    <div aria-hidden className="flex min-w-0 flex-col gap-4">
      <div className="rounded-3xl border border-[#e8ede4] bg-[#f8f9f7] p-3 shadow-[0_30px_60px_-40px_rgba(17,28,10,0.35)] sm:p-5">
        {/* Title and buttons */}
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="font-display text-[20px] font-bold text-[#111c0a]">
            {tm("title")} <span className="font-semibold text-[#6e7f65]">128</span>
          </div>
          <div className="flex gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-900 sm:inline-flex">
              <Download size={12} /> {tm("export")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#111c0a] px-3.5 py-1.5 text-[12px] font-medium text-white">
              {tm("addMember")}
            </span>
          </div>
        </div>

        {/* Status tabs with counts */}
        <div className="mb-3 flex gap-1.5 overflow-hidden">
          {tabs.map((tb) => {
            const on = tb.key === "all";
            const soon = tb.key === "ending";
            return (
              <span
                key={tb.key}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] ${
                  on
                    ? "border-brand-900 bg-brand-900 font-semibold text-white"
                    : soon
                      ? "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
                      : "border-[#e8ede4] bg-white text-[#3d4f35]"
                }`}
              >
                {tm(`tabs.${tb.key}`)}
                <span className={`ml-1 ${on ? "opacity-70" : soon ? "font-bold" : "text-[#6e7f65]"}`}>{tb.n}</span>
              </span>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e8ede4] bg-white">
          <div className="border-b border-[#e8ede4] bg-[#fbfcfa] px-3 py-2.5">
            <span className="flex h-8 items-center gap-2 rounded-xl border border-[#d0d9c9] bg-white px-2.5 text-[12px] text-[#6e7f65]">
              <Search size={13} className="shrink-0" />
              <span className="truncate">{tm("searchPlaceholder")}</span>
            </span>
          </div>
          <table className="w-full table-fixed text-[12px]">
            <thead>
              <tr>
                <th className={`${th} w-[42%] pl-4 sm:w-[32%]`}>{tm("columns.member")}</th>
                <th className={`${th} hidden w-[23%] sm:table-cell`}>{tm("columns.plan")}</th>
                <th className={`${th} w-[24%] sm:w-[20%]`}>{tm("columns.status")}</th>
                <th className={th}>{tm("columns.expires")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const soon = m.status === "active" && m.days <= 30;
                return (
                  <tr key={m.id} className="border-t border-[#e8ede4]">
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="truncate font-medium text-[#111c0a]">{m.name}</div>
                      <div className="truncate text-[11px] text-[#55664c]">{m.email}</div>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <div className="truncate text-[#3d4f35]">{m.plan.name}</div>
                      <div className="truncate text-[11px] text-[#55664c]">{price(m.plan)}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`${BADGE} ${memberStatusTone(m.status)}`}>{labels.memberStatus(m.status)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="truncate text-[#3d4f35]">{date(addDays(now, m.days))}</div>
                      <div className={`truncate text-[11px] ${soon ? "font-semibold text-[#b45309]" : "text-[#55664c]"}`}>
                        {m.days < 0 ? tm("daysAgo", { n: -m.days }) : tm("inDays", { n: m.days })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
          <div className="border-t border-brand-100 pt-3 text-[12px] text-brand-500">
            {tp("expires", { date: format(addDays(now, members[0].days), "d MMM yyyy", { locale: df }) })}
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

/* ── Ad · Play & compete — an Americano evening, live ─────────────────────── */

// Round 3 of a Friday Americano: the game on court 1 and the table so far.
const GAME = { a: ["Ana", "Marko"], b: ["Elena", "Bojan"], scoreA: 15, scoreB: 9 };
const TABLE = [
  { name: "Ana", played: 3, won: 3, points: 52 },
  { name: "Marko", played: 3, won: 2, points: 47, you: true },
  { name: "Sara", played: 3, won: 2, points: 44 },
  { name: "Elena", played: 3, won: 1, points: 38 },
];

function CompetePanel() {
  const t = useTranslations("features.mock");
  const ta = useTranslations("americano");
  const labels = makeLabels(useTranslations("labels"));
  const side = (names: string[], score: number, won: boolean) => (
    <div className="flex items-center justify-between gap-3">
      <span className={`min-w-0 truncate text-[14px] ${won ? "font-bold text-[#111c0a]" : "text-[#1e3010]"}`}>
        {names.join(" & ")}
      </span>
      <span className={`text-xl font-extrabold tabular-nums ${won ? "text-[#111c0a]" : "text-[#6e7f65]"}`}>{score}</span>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-3xl border border-[#e3eed3] bg-[#f3f8ec] p-3 sm:p-5">
      <div className="card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-[#111c0a]">{t("competeEvent")}</div>
            <div className="mt-0.5 text-[12px] text-[#6e7f65]">
              {ta("formats.americano")} ·{" "}
              <SportIcon sport="padel" size={13} className="-mt-0.5 align-middle" /> {labels.sport("padel")} ·{" "}
              {ta("pointsEach", { n: 24 })}
            </div>
          </div>
          <span className="badge-brand">{ta("roundTitle", { n: 3 })}</span>
        </div>
        <div className="rounded-2xl border border-ink-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e7f65]">{ta("court", { n: 1 })}</span>
            <Check size={15} className="text-brand-600" aria-hidden />
          </div>
          <div className="flex flex-col gap-2">
            {side(GAME.a, GAME.scoreA, true)}
            <div className="border-t border-dashed border-ink-100" />
            {side(GAME.b, GAME.scoreB, false)}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 sm:px-5">
          <span className="text-[14px] font-bold text-[#111c0a]">{ta("table")}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f3fbde] px-2.5 py-1 text-[11px] font-semibold text-[#4d7a08]">
            <TrendingUp size={12} aria-hidden />
            {t("competeLevel", { level: "3.62" })}
          </span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[#6e7f65]">
              <th className="w-9 py-2 pl-4 text-left font-medium sm:pl-5">#</th>
              <th className="py-2 text-left font-medium">{ta("player")}</th>
              <th className="w-9 py-2 text-center font-medium">{ta("played")}</th>
              <th className="w-9 py-2 text-center font-medium">{ta("won")}</th>
              <th className="w-14 py-2 pr-4 text-right font-medium sm:pr-5">{ta("points")}</th>
            </tr>
          </thead>
          <tbody>
            {TABLE.map((r, i) => (
              <tr key={r.name} className={`border-t border-ink-50 ${r.you ? "bg-brand-50" : ""}`}>
                <td className="py-2 pl-4 tabular-nums text-[#6e7f65] sm:pl-5">{i + 1}</td>
                <td className="py-2 font-medium text-[#111c0a]">
                  {r.name}
                  {r.you && <span className="ml-1.5 text-[11px] font-normal text-brand-700">{ta("you")}</span>}
                </td>
                <td className="py-2 text-center tabular-nums text-[#3d4f35]">{r.played}</td>
                <td className="py-2 text-center tabular-nums text-[#3d4f35]">{r.won}</td>
                <td className="py-2 pr-4 text-right font-bold tabular-nums text-[#111c0a] sm:pr-5">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
              <span className="flex w-[100px] shrink-0 items-center gap-1.5 text-[#3d4f35]">
                <SportIcon sport={s.sport} size={16} />
                <span className="truncate">{labels.sport(s.sport)}</span>
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

        <div className={`${ROW} border-b border-[#e8ede4]`}>
          <div className="order-last lg:order-none">
            <CompetePanel />
          </div>
          <FeatureCopy id="compete" />
        </div>

        <div className={ROW}>
          <FeatureCopy id="analytics">
            <StartLink href={`/${locale}/signup?role=admin`} label={t("cta")} />
          </FeatureCopy>
          <AnalyticsPanel />
        </div>
      </div>
    </section>
  );
}
