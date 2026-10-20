import { addDays, format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  Check,
  Globe,
  Percent,
  Repeat,
  Trophy,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { dateLocale } from "@/lib/dateLocale";

// The landing-page hero with the product in it: the real booking screen on a
// phone, two cards fanned out behind it (a weekly booking and a reminder
// email), green paper waves along the bottom and the stats bar floating over
// the bottom edge. It replaces Hero.tsx on the home page; Hero.tsx is kept, so
// switching back is one line in src/app/[locale]/page.tsx.

/** Free (open), already booked (taken) or the slot being booked (picked). */
type Slot = { time: string; state: "open" | "taken" | "picked" };

const SLOT_STYLE: Record<Slot["state"], string> = {
  open: "border border-brand-200 bg-brand-50 text-brand-900",
  taken: "bg-ink-50 text-[#9aa892] line-through",
  picked: "bg-brand-400 font-semibold text-ink-900",
};

/** The phone's court list. Names and times are an illustration. */
const COURTS: {
  n: number;
  kind: "clay" | "padel" | "indoor";
  slots: Slot[];
}[] = [
  {
    n: 1,
    kind: "clay",
    slots: [
      { time: "17:00", state: "taken" },
      { time: "18:00", state: "open" },
      { time: "20:00", state: "open" },
    ],
  },
  {
    n: 2,
    kind: "padel",
    slots: [
      { time: "17:00", state: "open" },
      { time: "19:00", state: "picked" },
      { time: "20:30", state: "taken" },
    ],
  },
  {
    n: 3,
    kind: "indoor",
    slots: [
      { time: "16:00", state: "open" },
      { time: "18:30", state: "taken" },
      { time: "21:00", state: "open" },
    ],
  },
];

const BLUE = "#2f5fe0";

export default function HeroProduct() {
  const t = useTranslations("heroProduct");
  const ts = useTranslations("hero");
  const locale = useLocale();
  const dfLocale = dateLocale(locale);

  // The next four days, with the second one picked, like a player booking.
  const days = Array.from({ length: 4 }, (_, i) => addDays(new Date(), i));
  const pickedDay = format(days[1], "EEEE", { locale: dfLocale });
  const nextDay = format(days[2], "EEE", { locale: dfLocale });

  // Facts about the product, not made-up usage numbers (same as Hero.tsx).
  const stats = [
    {
      value: "30",
      suffix: ts("stats.daysSuffix"),
      label: ts("stats.trial"),
      icon: CalendarCheck,
    },
    { value: "0", suffix: "%", label: ts("stats.commission"), icon: Percent },
    { value: "3", suffix: "", label: ts("stats.sports"), icon: Trophy },
    { value: "6", suffix: "", label: ts("stats.languages"), icon: Globe },
  ];

  return (
    <section className="relative">
      <div className="relative overflow-hidden bg-[#f3f8ec]">
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 800"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
        >
          <circle cx="560" cy="430" r="560" fill="#e8f2db" />
          <circle
            cx="1180"
            cy="400"
            r="250"
            fill="none"
            stroke="#d6e6c4"
            strokeWidth="1.5"
          />
          <circle
            cx="1180"
            cy="400"
            r="330"
            fill="none"
            stroke="#dfeccf"
            strokeWidth="1.5"
          />
        </svg>

        {/* Green paper waves along the bottom */}
        {/* <svg
          aria-hidden="true"
          viewBox="0 0 1440 140"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-[110px] w-full lg:h-[140px]"
        >
          <defs>
            <filter
              id="hero-wave-shadow"
              x="-5%"
              y="-60%"
              width="110%"
              height="220%"
            >
              <feDropShadow
                dx="0"
                dy="-8"
                stdDeviation="12"
                floodColor="#0b1a05"
                floodOpacity="0.16"
              />
            </filter>
          </defs>
          <path
            filter="url(#hero-wave-shadow)"
            d="M0 140 V60 C200 20 360 70 540 82 C740 96 900 30 1080 16 C1240 4 1360 40 1440 20 V140 Z"
            fill="#d9f08f"
          />
          <path
            filter="url(#hero-wave-shadow)"
            d="M0 140 V100 C200 70 400 110 600 116 C800 122 960 76 1140 70 C1280 66 1380 90 1440 80 V140 Z"
            fill="#a8d832"
          />
        </svg> */}

        <div className="relative mx-auto flex max-w-[1280px] flex-wrap items-center gap-12 px-6 pb-28 lg:min-h-[820px] lg:px-10 lg:pb-32">
          {/* Text */}
          <div className="flex min-w-0 max-w-[560px] flex-[1_1_480px] flex-col gap-7 pt-16 lg:py-24">
            <h1 className="text-[42px] font-semibold leading-[1.04] tracking-[-0.045em] text-[#0e1a07] text-balance sm:text-[56px] lg:text-[64px]">
              {t("title")}
              <span className="text-brand-400">.</span>
            </h1>
            <p className="max-w-[450px] text-lg font-light leading-relaxed text-ink-800 text-pretty">
              {t("subtitle")}
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link
                href="/signup?role=admin"
                className="inline-flex min-h-14 items-center gap-3 rounded-full bg-brand-400 px-7 text-base font-semibold text-[#0e1a07] transition-colors hover:bg-brand-200"
              >
                {t("start")}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center text-[15px] min-h-14 px-7 bg-white rounded-full font-medium text-ink-900 hover:text-brand-800"
              >
                {t("seeHow")}
              </a>
            </div>
          </div>

          {/* Product: drawn at 560×620 and scaled down on phones */}
          <div className="flex min-w-0 flex-[1_1_520px] justify-center lg:pt-10">
            <div className="h-[376px] w-[340px] sm:h-[620px] sm:w-[560px]">
              <div
                aria-hidden="true"
                className="relative h-[620px] w-[560px] origin-top-left scale-[0.607] sm:scale-100"
              >
                {/* Behind the phone: a weekly booking … */}
                <div className="absolute left-[10px] top-[120px] flex h-[300px] w-[230px] -rotate-[11deg] flex-col gap-2.5 rounded-[26px] bg-white p-[22px] shadow-[0_30px_60px_-30px_rgba(17,28,10,0.35)]">
                  <span className="flex items-center gap-2 text-xs text-ink-600">
                    <Repeat
                      size={14}
                      strokeWidth={2.4}
                      className="text-brand-800"
                    />
                    {t("weeklyCard.label")}
                  </span>
                  <span className="text-xl font-semibold leading-tight text-ink-900">
                    {t("weeklyCard.when", { day: pickedDay })}
                  </span>
                  <span className="text-xs text-ink-600">
                    {t("weeklyCard.who")}
                  </span>
                  <span className="mt-1.5 flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${i < 3 ? "bg-brand-400" : "bg-ink-100"}`}
                      />
                    ))}
                  </span>
                  <span className="text-[11px] text-ink-600">
                    {t("weeklyCard.progress", { week: 3, weeks: 12 })}
                  </span>
                </div>

                {/* … and a reminder email */}
                <div className="absolute right-0 top-[150px] flex h-[290px] w-[230px] rotate-[10deg] flex-col gap-2.5 rounded-[26px] bg-white p-[22px] shadow-[0_30px_60px_-30px_rgba(23,50,127,0.4)]">
                  <span className="flex items-center gap-2 text-xs text-ink-600">
                    <Bell size={14} strokeWidth={2.2} style={{ color: BLUE }} />
                    {t("reminderCard.label")}
                  </span>
                  <span className="text-xl font-semibold leading-tight text-ink-900">
                    {t("reminderCard.title")}
                  </span>
                  <span className="text-xs text-ink-600">
                    {t("phone.court", { n: 3 })} · {nextDay} 10:00 · 90 min
                  </span>
                  <span className="mt-auto self-start rounded-full bg-[#e1eaff] px-3 py-1.5 text-[11px] font-semibold text-[#17327f]">
                    {t("reminderCard.sent")}
                  </span>
                </div>

                {/* Phone */}
                <div className="absolute left-[145px] top-0 h-[560px] w-[270px] -rotate-3 rounded-[42px] bg-ink-900 p-2.5 shadow-[0_50px_80px_-30px_rgba(11,26,5,0.5)]">
                  <div className="flex h-full w-full flex-col overflow-hidden rounded-[33px] bg-white">
                    <div
                      className="flex flex-col gap-0.5 px-[18px] pb-3.5 pt-6 text-white"
                      style={{ background: BLUE }}
                    >
                      <span className="text-[11px] opacity-85">
                        {t("phone.club")}
                      </span>
                      <span className="text-lg font-semibold">
                        {t("phone.title")}
                      </span>
                    </div>
                    <div className="flex gap-1.5 px-3.5 pb-1.5 pt-3.5">
                      {days.map((d, i) => (
                        <span
                          key={i}
                          className={`flex-1 rounded-[10px] py-[7px] text-center text-[10px] leading-[1.3] ${
                            i === 1
                              ? "bg-ink-900 text-ink-200"
                              : "bg-ink-50 text-ink-600"
                          }`}
                        >
                          {format(d, "EEE", { locale: dfLocale })}
                          <br />
                          <strong
                            className={`text-[13px] ${i === 1 ? "text-white" : "text-ink-900"}`}
                          >
                            {format(d, "d")}
                          </strong>
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-col gap-3 px-3.5 py-2.5">
                      {COURTS.map((court) => (
                        <div key={court.n} className="flex flex-col gap-[7px]">
                          <span className="text-xs font-semibold text-ink-900">
                            {t("phone.court", { n: court.n })} ·{" "}
                            {t(`phone.${court.kind}`)}
                          </span>
                          <div className="grid grid-cols-3 gap-[5px] text-center text-[11px]">
                            {court.slots.map((s) => (
                              <span
                                key={s.time}
                                className={`rounded-lg py-[7px] ${SLOT_STYLE[s.state]}`}
                              >
                                {s.time}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-auto flex flex-col gap-2.5 border-t border-ink-100 p-3.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-600">
                          {t("phone.court", { n: 2 })} ·{" "}
                          {format(days[1], "EEE", { locale: dfLocale })} 19:00 ·
                          60 min
                        </span>
                        <strong>€12</strong>
                      </div>
                      <span className="block rounded-full bg-ink-900 py-[11px] text-center text-xs font-semibold text-white">
                        {t("phone.confirm")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Round icons around the phone */}
                <span className="absolute left-[95px] top-[470px] grid size-16 place-items-center rounded-full bg-white shadow-[0_16px_34px_-14px_rgba(17,28,10,0.35)]">
                  <span className="grid size-11 place-items-center rounded-full bg-brand-400">
                    <CalendarCheck size={20} className="text-ink-900" />
                  </span>
                </span>
                <span className="absolute right-[40px] top-[60px] grid size-16 place-items-center rounded-full bg-white shadow-[0_16px_34px_-14px_rgba(17,28,10,0.35)]">
                  <span
                    className="grid size-11 place-items-center rounded-full"
                    style={{ background: BLUE }}
                  >
                    <Check size={20} strokeWidth={2.6} className="text-white" />
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar, half over the hero and half over the next section (as in Hero.tsx) */}
      {/* On large screens it takes no height, so the next section starts right at the edge. */}
      <div className="relative z-10 -mt-14 flex items-start justify-center px-6 pb-12 lg:mt-0 lg:h-0 lg:pb-0">
        <div className="w-full max-w-[1180px] lg:-translate-y-1/2">
          <div className="grid grid-cols-2 rounded-3xl border border-[#e8ede4] bg-white shadow-[0_1px_2px_rgba(17,28,10,0.04),0_16px_48px_-12px_rgba(17,28,10,0.14)] lg:grid-cols-4">
            {stats.map(({ value, suffix, label, icon: Icon }, i) => (
              <div
                key={label}
                className={`group relative flex flex-col items-start gap-3 border-[#e8ede4] px-5 py-6 sm:flex-row sm:items-center sm:gap-4 sm:px-7 sm:py-7 ${
                  i % 2 === 1 ? "border-l lg:border-l-0" : ""
                } ${i >= 2 ? "border-t lg:border-t-0" : ""}`}
              >
                {i > 0 && (
                  <span className="absolute left-0 top-1/2 hidden h-10 w-px -translate-y-1/2 bg-[#e8ede4] lg:block" />
                )}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d6f09a] bg-[#f3fbde] text-[#7aad12] transition-colors duration-200 group-hover:border-[#7aad12] group-hover:bg-[#7aad12] group-hover:text-white">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <div>
                  <div className="font-display text-[32px] font-extrabold leading-none tracking-[-1.5px] text-[#111c0a]">
                    {value}
                    <span
                      className={`text-[#7aad12] ${suffix.length > 1 ? "ml-1 text-[18px] font-bold tracking-normal" : ""}`}
                    >
                      {suffix}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[13px] text-[#6e7f65]">
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
