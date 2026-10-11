import { ArrowUpRight } from "lucide-react";
import { getLocale } from "next-intl/server";
import Link from "next/link";

/**
 * Copy for the four feature rows. They are numbered like a tennis game:
 * 15 → 30 → 40 → Game. `mark` is the part of the title that gets the
 * lime highlighter stroke.
 */
const copy = [
  {
    score: "15",
    label: "Court bookings",
    title: { pre: "Book it ", mark: "your way", post: "" },
    body: "Real-time court availability, instant confirmations, and zero double-bookings. Give members a booking experience they'll love on any device.",
    points: [
      "Drag-and-drop schedule management",
      "Recurring & block booking rules",
      "Automated waitlist management",
      "Member-tier booking windows",
    ],
    cta: "Explore booking features",
  },
  {
    score: "30",
    label: "Membership",
    title: { pre: "Complete ", mark: "member", post: " management" },
    body: "Keep all your contacts in one place. Track membership status, payments, activity history and skill levels — with tools to stay in touch and grow retention.",
    points: [
      "Flexible membership plan builder",
      "Automated renewal reminders",
      "Player skill-level profiles",
      "Bulk email & SMS communication",
    ],
    cta: "Explore membership tools",
  },
  {
    score: "40",
    label: "Coaching",
    title: { pre: "Pack your coaches' ", mark: "calendars", post: "" },
    body: "Let players browse and book lessons directly. Manage coach availability, lesson types, group sessions and clinics — and fill every hour automatically.",
    points: [
      "Individual & group lesson scheduling",
      "Coach profile pages & ratings",
      "Automatic coach payout tracking",
      "Lesson confirmation & reminders",
    ],
    cta: "Explore coaching features",
  },
  {
    score: "Game",
    label: "Analytics",
    title: { pre: "", mark: "Data-driven", post: " decisions" },
    body: "Understand exactly how your club is performing. Track revenue by court, coach or membership plan. Spot peak hours and act on real numbers.",
    points: [
      "Revenue by court, coach & period",
      "Court utilisation heatmaps",
      "Membership churn tracking",
      "Exportable financial reports",
    ],
    cta: "Explore analytics",
  },
];

/** Text side of a feature row: scoreboard chip, title, body, points, CTA. */
function FeatureCopy({
  score,
  label,
  title,
  body,
  points,
  cta,
  href,
}: (typeof copy)[number] & { href: string }) {
  return (
    <div>
      {/* Scoreboard chip + label + baseline */}
      <div className="flex items-center gap-3 mb-6">
        <span className="font-display text-[13px] font-extrabold leading-none tabular-nums bg-[#111c0a] text-[#a8d832] rounded-md px-2.5 py-1.5">
          {score}
        </span>
        <span className="text-[11px] font-semibold text-[#3d4f35] uppercase tracking-widest whitespace-nowrap">
          {label}
        </span>
        <span aria-hidden className="h-px flex-1 bg-[#d0d9c9]" />
      </div>

      <h2 className="font-display text-[32px] sm:text-[38px] lg:text-[46px] font-extrabold text-[#111c0a] tracking-tight leading-[1.05] mb-5">
        {title.pre}
        <span className="box-decoration-clone bg-[linear-gradient(transparent_58%,#d6f09a_58%,#d6f09a_92%,transparent_92%)] px-1 -mx-1">
          {title.mark}
        </span>
        {title.post}
      </h2>

      <p className="text-[16px] text-[#6e7f65] leading-relaxed mb-8 max-w-[52ch]">
        {body}
      </p>

      {/* Points laid out like court lines: ruled rows, two-up from sm */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8 border-b border-[#e8ede4] mb-8">
        {points.map((p) => (
          <li
            key={p}
            className="flex items-center gap-3 border-t border-[#e8ede4] py-3.5 text-[14px] font-medium text-[#1e3010]"
          >
            <span
              aria-hidden
              className="size-2 flex-shrink-0 rounded-full bg-[#a8d832] ring-4 ring-[#f3fbde]"
            />
            {p}
          </li>
        ))}
      </ul>

      {/* Serve link — same ball-and-arrow pill as the sports section */}
      <Link
        href={href}
        className="group/btn inline-flex w-fit items-center gap-3 rounded-full border border-[#111c0a] bg-[#111c0a] py-1.5 pl-5 pr-1.5 text-sm font-semibold text-white transition-[background-color,border-color,color,transform] duration-300 ease-out hover:border-[#a8d832] hover:bg-[#a8d832] hover:text-[#111c0a] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7aad12] motion-reduce:transition-none"
      >
        {cta}
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
    </div>
  );
}

export default async function Features() {
  const locale = await getLocale();
  const signupHref = `/${locale}/signup?role=admin`;
  return (
    <section id="features" className="relative overflow-hidden">
      {/* <img
    className="absolute"
    src="https://images.unsplash.com/photo-1622669253059-e345500cf0e9?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    alt=""
  /> */}
      <div className="max-w-[1180px] mx-auto px-6 py-4 lg:px-10 lg:py-10">
        {/* 1. Booking */}
        <div className="grid grid-cols-1 gap-10 items-center py-14 lg:grid-cols-2 lg:gap-20 lg:py-24 border-b border-[#e8ede4]">
          <FeatureCopy {...copy[0]} href={signupHref} />
          {/* Weekly calendar panel */}
          <div className="bg-white border border-[#e8ede4] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#e8ede4] flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-[#111c0a]">
                All courts — this week
              </span>
              <span className="text-[11px] bg-[#f3fbde] text-[#7aad12] px-3 py-1 rounded-md font-medium whitespace-nowrap">
                Save schedule
              </span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-8 gap-1 mb-2 text-[10px] text-[#6e7f65] font-semibold">
                <div></div>
                {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
                  <div
                    key={d}
                    className={`text-center ${d === "WED" ? "text-[#7aad12]" : ""}`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              {[
                ["08:00", [1, 0, 2, 1, 0, 2, 0]],
                ["10:00", [0, 1, 0, 2, 1, 0, 1]],
                ["12:00", [2, 0, 1, 0, 2, 1, 0]],
                ["14:00", [0, 2, 0, 1, 0, 0, 1]],
              ].map(([time, pattern]) => (
                <div
                  key={time as string}
                  className="grid grid-cols-8 gap-1 mb-1"
                >
                  <div className="text-[10px] text-[#6e7f65] pt-1.5">
                    {time as string}
                  </div>
                  {(pattern as number[]).map((p, i) => (
                    <div
                      key={i}
                      className={`h-7 rounded ${
                        p === 0
                          ? "bg-[#f3fbde] border border-[#d6f09a]"
                          : p === 2
                            ? "bg-[#111c0a]"
                            : "bg-[#f0f0f0]"
                      }`}
                    />
                  ))}
                </div>
              ))}
              <div className="flex gap-4 mt-3 pt-3 border-t border-[#e8ede4]">
                {[
                  ["#f3fbde", "#d6f09a", "Available"],
                  ["#111c0a", null, "Booked"],
                  ["#f0f0f0", null, "Closed"],
                ].map(([bg, border, label]) => (
                  <div
                    key={label as string}
                    className="flex items-center gap-1.5 text-[10px] text-[#6e7f65]"
                  >
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{
                        background: bg as string,
                        border: border ? `1px solid ${border}` : undefined,
                      }}
                    />
                    {label as string}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Members — flipped on desktop, text first on mobile */}
        <div className="grid grid-cols-1 gap-10 items-center py-14 lg:grid-cols-2 lg:gap-20 lg:py-24 border-b border-[#e8ede4]">
          {/* Panel first on desktop */}
          <div className="order-last lg:order-none bg-white border border-[#e8ede4] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#e8ede4] flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-[#111c0a]">
                Members (342)
              </span>
              <span className="text-[11px] bg-[#111c0a] text-white px-3 py-1 rounded-md font-medium cursor-pointer whitespace-nowrap">
                + Invite
              </span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-[#f3fbde] border border-[#d6f09a] rounded-lg p-3">
                  <div className="font-display text-[22px] font-bold text-[#7aad12]">
                    294
                  </div>
                  <div className="text-[10px] text-[#6e7f65]">
                    Active members
                  </div>
                </div>
                <div className="bg-[#f8f9f7] border border-[#e8ede4] rounded-lg p-3">
                  <div className="font-display text-[22px] font-bold text-[#111c0a]">
                    €8,460
                  </div>
                  <div className="text-[10px] text-[#6e7f65]">
                    Monthly revenue
                  </div>
                </div>
              </div>
              {[
                {
                  init: "MK",
                  bg: "#3a7020",
                  name: "Marko Kostovski",
                  plan: "Club plan",
                  status: "Active",
                  sc: "#7aad12",
                  sb: "#f3fbde",
                },
                {
                  init: "AJ",
                  bg: "#7aad12",
                  name: "Ana Jovanova",
                  plan: "Academy plan",
                  status: "Active",
                  sc: "#7aad12",
                  sb: "#f3fbde",
                },
                {
                  init: "DP",
                  bg: "#d6c832",
                  name: "Dragan Petrović",
                  plan: "Starter plan",
                  status: "Pending",
                  sc: "#8a7800",
                  sb: "#fdfae0",
                },
                {
                  init: "NR",
                  bg: "#2ab87a",
                  name: "Nina Ristova",
                  plan: "Club plan",
                  status: "Active",
                  sc: "#7aad12",
                  sb: "#f3fbde",
                },
              ].map((m) => (
                <div
                  key={m.name}
                  className="flex items-center gap-3 py-2.5 border-b border-[#e8ede4] last:border-0"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                    style={{ background: m.bg }}
                  >
                    {m.init}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#111c0a]">
                      {m.name}
                    </div>
                    <div className="text-[11px] text-[#6e7f65]">{m.plan}</div>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{ background: m.sb, color: m.sc }}
                  >
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <FeatureCopy {...copy[1]} href={signupHref} />
        </div>

        {/* 3. Coaching */}
        <div className="grid grid-cols-1 gap-10 items-center py-14 lg:grid-cols-2 lg:gap-20 lg:py-24 border-b border-[#e8ede4]">
          <FeatureCopy {...copy[2]} href={signupHref} />
          <div className="bg-white border border-[#e8ede4] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#e8ede4]">
              <span className="text-[13px] font-semibold text-[#111c0a]">
                Our coaching team
              </span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {[
                {
                  init: "TK",
                  bg: "#3a7020",
                  name: "Tomislav Kovač",
                  spec: "Head coach · ITF Level 3",
                  slots: ["09:00", "11:00", "14:00"],
                  open: 3,
                },
                {
                  init: "SF",
                  bg: "#7aad12",
                  name: "Sara Filipovska",
                  spec: "Junior specialist · ITF Level 2",
                  slots: ["10:00", "15:30"],
                  open: 2,
                },
                {
                  init: "BN",
                  bg: "#2ab87a",
                  name: "Boris Nikolovski",
                  spec: "Performance · ITF Level 3",
                  slots: ["08:00", "12:00", "16:00"],
                  open: 4,
                },
              ].map((c) => (
                <div
                  key={c.name}
                  className="bg-[#f8f9f7] border border-[#e8ede4] rounded-xl p-3 flex gap-3 items-start"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                    style={{ background: c.bg }}
                  >
                    {c.init}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#111c0a]">
                      {c.name}
                    </div>
                    <div className="text-[11px] text-[#6e7f65] mb-2">
                      {c.spec}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {c.slots.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] bg-[#f3fbde] text-[#7aad12] px-2 py-0.5 rounded font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-[#f3fbde] text-[#7aad12] px-2 py-1 rounded-md whitespace-nowrap">
                    {c.open} open
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Analytics — flipped on desktop, text first on mobile */}
        <div className="grid grid-cols-1 gap-10 items-center py-14 lg:grid-cols-2 lg:gap-20 lg:py-24">
          <div className="order-last lg:order-none bg-white border border-[#e8ede4] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#e8ede4] flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="text-[13px] font-semibold text-[#111c0a]">
                Revenue — last 6 months
              </span>
              <span className="text-[12px] font-semibold text-[#7aad12]">
                ↑ 23% vs last year
              </span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  ["€38.7k", "#7aad12", "#f3fbde", "#d6f09a", "Total revenue"],
                  ["342", "#111c0a", "#f8f9f7", "#e8ede4", "Active members"],
                  ["€843", "#111c0a", "#f8f9f7", "#e8ede4", "Avg / month"],
                ].map(([v, tc, bg, bc, l]) => (
                  <div
                    key={l as string}
                    className="rounded-lg p-3 border"
                    style={{
                      background: bg as string,
                      borderColor: bc as string,
                    }}
                  >
                    <div
                      className="font-display text-[18px] font-bold"
                      style={{ color: tc as string }}
                    >
                      {v as string}
                    </div>
                    <div className="text-[10px] text-[#6e7f65]">
                      {l as string}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2 h-24 mb-2">
                {[
                  ["Nov", 50],
                  ["Dec", 65],
                  ["Jan", 52],
                  ["Feb", 75],
                  ["Mar", 68],
                  ["Apr", 88],
                ].map(([m, h], i) => (
                  <div
                    key={m as string}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: `${h}%`,
                        background: i === 5 ? "#111c0a" : "#f3fbde",
                        border: i === 5 ? "none" : "1px solid #d6f09a",
                      }}
                    />
                    <div
                      className="text-[9px] font-medium"
                      style={{ color: i === 5 ? "#111c0a" : "#6e7f65" }}
                    >
                      {m as string}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e8ede4] pt-3 flex flex-wrap justify-between items-center gap-x-3 gap-y-1">
                <span className="text-[11px] text-[#6e7f65]">
                  Court bookings vs coaching revenue
                </span>
                <span className="text-[11px] font-semibold text-[#7aad12] cursor-pointer">
                  Export CSV →
                </span>
              </div>
            </div>
          </div>
          <FeatureCopy {...copy[3]} href={signupHref} />
        </div>
      </div>
    </section>
  );
}
