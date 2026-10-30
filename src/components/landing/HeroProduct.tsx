import { addDays, format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  Check,
  Globe,
  MapPin,
  Percent,
  Repeat,
  Trophy,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import CourtArt from "@/components/courts/CourtArt";
import { dateLocale } from "@/lib/dateLocale";
import { makeLabels } from "@/lib/labels";
import { courtColor } from "@/lib/courtColors";
import type { Sport, Surface } from "@/types/database";

// The landing-page hero with the product in it. The three screens copy the
// real app, with its own texts, court drawings and colours: the players'
// "Book a court" page on a phone, the booking sheet that opens when they tap a
// court (left), and their next booking with its reminder (right). It replaces
// Hero.tsx on the home page; Hero.tsx is kept, so switching back is one line
// in src/app/[locale]/page.tsx.

/** The phone's courts, as cards on the booking page. Made-up example club. */
const COURTS: { name: string; n: number; sport: Sport; surface: Surface; indoor: boolean; price: number }[] = [
  { name: "court", n: 1, sport: "tennis", surface: "clay", indoor: false, price: 16 },
  { name: "padel", n: 1, sport: "padel", surface: "artificial_grass", indoor: true, price: 20 },
  { name: "court", n: 3, sport: "tennis", surface: "hard", indoor: true, price: 18 },
];

/** The booking sheet's times: one taken, one picked (19:00). */
const TIMES: { h: number; state: "open" | "taken" | "picked" }[] = [
  { h: 17, state: "open" },
  { h: 18, state: "taken" },
  { h: 19, state: "picked" },
  { h: 20, state: "open" },
  { h: 21, state: "open" },
  { h: 22, state: "taken" },
];
const TIME_STYLE = {
  open: "border-ink-100 bg-white text-ink-900",
  taken: "border-transparent bg-ink-50 text-ink-400 line-through",
  picked: "border-brand-600 bg-brand-600 text-white",
} as const;

export default function HeroProduct() {
  const t = useTranslations("heroProduct");
  const ts = useTranslations("hero");
  const tb = useTranslations("bookCourts");
  const tm = useTranslations("myBookings");
  const labels = makeLabels(useTranslations("labels"));
  const locale = useLocale();
  const dfLocale = dateLocale(locale);
  const courtName = (c: (typeof COURTS)[number]) =>
    c.name === "padel" ? `${labels.sport("padel")} ${c.n}` : t("phone.court", { n: c.n });

  // The next four days, with the second one picked, like a player booking.
  const days = Array.from({ length: 4 }, (_, i) => addDays(new Date(), i));
  const pickedDay = format(days[1], "EEEE", { locale: dfLocale });

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
                {/* Left, behind the phone: the booking sheet for Padel 1 */}
                <div className="absolute -left-[4px] sm:-left-[40px] top-[112px] flex w-[236px] -rotate-[11deg] flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_30px_60px_-30px_rgba(17,28,10,0.35)]">
                  <div className="relative h-[64px] w-full shrink-0 overflow-hidden">
                    <CourtArt court={{ sport: "padel", surface: "artificial_grass" }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                    <div className="absolute bottom-2 left-4 text-white">
                      <p className="text-[13px] font-bold leading-tight">{courtName(COURTS[1])}</p>
                      <p className="text-[10px] text-white/85">
                        {labels.surface("artificial_grass")} · {labels.inOut(true)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    <div className="flex gap-1.5">
                      {days.map((d, i) => {
                        const on = i === 1;
                        return (
                          <span
                            key={i}
                            className={`flex flex-1 flex-col items-center rounded-lg border py-1 ${
                              on ? "border-ink-900 bg-ink-900 text-white" : "border-ink-100 bg-white text-ink-900"
                            }`}
                          >
                            <span className={`text-[8px] font-medium uppercase ${on ? "text-white/70" : "text-ink-400"}`}>
                              {i === 0 ? tb("today") : format(d, "EEE", { locale: dfLocale })}
                            </span>
                            <span className="text-[13px] font-bold leading-tight">{format(d, "d")}</span>
                          </span>
                        );
                      })}
                    </div>
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold text-ink-600">{tb("startTime")}</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {TIMES.map((x) => (
                          <span
                            key={x.h}
                            className={`rounded-md border py-1.5 text-center text-[11px] font-semibold tabular-nums ${TIME_STYLE[x.state]}`}
                          >
                            {x.h}:00
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-ink-100 bg-[#f8f9f7] px-3 py-2 text-[11px]">
                      <span className="text-ink-600">
                        {format(days[1], "EEE d MMM", { locale: dfLocale })}, 19:00–20:00
                      </span>
                      <span className="text-[13px] font-extrabold text-ink-900">€20</span>
                    </div>
                    <span className="block rounded-full bg-ink-900 py-2 text-center text-[11px] font-semibold text-white">
                      {tb("confirm", { price: "20" })}
                    </span>
                  </div>
                </div>

                {/* Right, behind the phone: the player's next booking and its reminder */}
                <div className="absolute -right-[12px] sm:-right-[52px] top-[150px] flex w-[230px] rotate-[10deg] flex-col gap-3 rounded-[26px] bg-white p-5 shadow-[0_30px_60px_-30px_rgba(17,28,10,0.35)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{tm("nextUp")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="badge-brand px-2 py-0.5 text-[10px]">{labels.bookingStatus("confirmed")}</span>
                    <span className="badge bg-ink-50 px-2 py-0.5 text-[10px] text-ink-800">
                      <Repeat size={10} aria-hidden="true" />
                      {t("weeklyCard.label")}
                    </span>
                  </div>
                  <div>
                    <p className="text-[17px] font-bold leading-tight text-ink-900">{t("weeklyCard.when", { day: pickedDay })}</p>
                    <p className="mt-1 text-[11px] text-ink-600">
                      {courtName(COURTS[1])} · {tb("minutes", { n: 60 })} · Emma L.
                    </p>
                  </div>
                  <div>
                    <span className="flex gap-1">
                      {Array.from({ length: 12 }, (_, i) => (
                        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < 3 ? "bg-brand-400" : "bg-ink-100"}`} />
                      ))}
                    </span>
                    <span className="mt-1.5 block text-[10px] text-ink-600">{t("weeklyCard.progress", { week: 3, weeks: 12 })}</span>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl border border-ink-100 bg-[#f8f9f7] p-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800">
                      <Bell size={13} strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold leading-tight text-ink-900">{t("reminderCard.title")}</span>
                      <span className="mt-0.5 block text-[10px] text-ink-600">{t("reminderCard.sent")}</span>
                    </span>
                  </div>
                </div>

                {/* Phone: the players' "Book a court" page */}
                <div className="absolute left-[145px] top-0 h-[560px] w-[270px] -rotate-3 rounded-[42px] bg-ink-900 p-2.5 shadow-[0_50px_80px_-30px_rgba(11,26,5,0.5)]">
                  <div className="flex h-full w-full flex-col overflow-hidden rounded-[33px] bg-[#f8f9f7]">
                    <div className="px-4 pb-2 pt-7">
                      <p className="text-[19px] font-extrabold tracking-tight text-ink-900">{tb("title")}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-600">
                        <MapPin size={11} className="shrink-0 text-ink-400" />
                        <span className="truncate">{t("phone.club")}</span>
                      </p>
                    </div>
                    <div className="flex gap-1.5 px-4 pb-3 pt-1">
                      {[tb("allSports"), labels.sport("tennis"), labels.sport("padel")].map((label, i) => (
                        <span
                          key={label}
                          className={`rounded-full border px-3 py-1 text-[10px] font-medium ${
                            i === 0 ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600"
                          }`}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2.5 px-3.5">
                      {COURTS.map((c) => (
                        <div key={`${c.name}${c.n}`} className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
                          <div className="relative h-[70px] w-full overflow-hidden">
                            <CourtArt court={{ sport: c.sport, surface: c.surface }} />
                            <span className="absolute left-2 top-2 rounded-full bg-black/35 px-2 py-0.5 text-[9px] font-semibold text-white">
                              {labels.sport(c.sport)}
                            </span>
                            <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-semibold text-ink-900">
                              {labels.inOut(c.indoor)}
                            </span>
                          </div>
                          <div className="flex items-end justify-between gap-2 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-bold text-ink-900">{courtName(c)}</p>
                              <p className="truncate text-[10px] text-ink-600">
                                {labels.surface(c.surface)} · {labels.courtColor(courtColor({ sport: c.sport, surface: c.surface }))}
                              </p>
                              <p className="mt-1 text-ink-900">
                                <span className="text-[13px] font-extrabold">€{c.price}</span>
                                <span className="text-[10px] text-ink-600"> {tb("perHour")}</span>
                              </p>
                            </div>
                            <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-ink-900 px-3 text-[10px] font-semibold text-white">
                              {tb("book")}
                              <ArrowRight size={10} />
                            </span>
                          </div>
                        </div>
                      ))}
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
                  <span className="grid size-11 place-items-center rounded-full bg-ink-900">
                    <Check size={20} strokeWidth={2.6} className="text-brand-400" />
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
