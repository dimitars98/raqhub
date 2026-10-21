import { addDays, format, nextSaturday, nextTuesday } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Download, Link2, Plus } from "lucide-react";
import { appUrl } from "@/lib/email/bookings";
import { dateLocale } from "@/lib/dateLocale";

// "Built for clubs": what Kortello does around a booking that the Features
// rows above don't cover. Each card shows a small piece of the real app
// instead of an icon. The club and people in it are a made-up example.

const CLUB = "Riverside Tennis Club";
const CLUB_SLUG = "riverside-tennis";
const STAFF_EMAIL = "desk@riversidetc.com";

/** Card title, in the site's display face. */
function Title({ children, big = false }: { children: React.ReactNode; big?: boolean }) {
  return (
    <h3
      className={`font-display font-extrabold leading-tight tracking-tight ${
        big ? "text-[24px] sm:text-[26px]" : "text-[20px]"
      }`}
    >
      {children}
    </h3>
  );
}

/** A tiny QR-code drawing for the poster (not a real code). */
function QrMark() {
  return (
    <svg aria-hidden="true" width="84" height="84" viewBox="0 0 21 21" fill="#ffffff" shapeRendering="crispEdges">
      <path d="M0 0h7v7H0zM1 1v5h5V1zM2 2h3v3H2zM14 0h7v7h-7zM15 1v5h5V1zM16 2h3v3h-3zM0 14h7v7H0zM1 15v5h5v-5zM2 16h3v3H2zM8 0h2v2H8zM11 1h2v3h-2zM8 3h1v3H8zM10 5h3v2h-3zM8 8h3v1H8zM12 8h2v3h-2zM15 8h3v2h-3zM19 9h2v2h-2zM0 8h2v2H0zM3 9h3v2H3zM8 10h2v3H8zM11 12h3v2h-3zM15 12h2v2h-2zM18 12h3v1h-3zM8 15h2v2H8zM11 15h1v3h-1zM13 16h3v2h-3zM17 15h2v3h-2zM19 19h2v2h-2zM8 19h4v2H8zM14 19h3v2h-3z" />
    </svg>
  );
}

export default function FeatureCards() {
  const t = useTranslations("featureCards");
  const locale = useLocale();
  const df = dateLocale(locale);
  const day = (d: Date) => format(d, "EEE d MMM", { locale: df });

  // Example dates that are always in the near future.
  const today = new Date();
  const firstTuesday = nextTuesday(today);
  const weeks = [0, 1, 2, 3].map((i) => ({ date: addDays(firstTuesday, i * 7), skipped: i === 2 }));
  const finalDay = format(nextSaturday(today), "EEE", { locale: df });
  const reminderDay = format(addDays(today, 1), "EEE", { locale: df });
  const host = new URL(appUrl()).host;

  return (
    <section className="max-w-[1180px] mx-auto px-6 py-16 lg:px-10 lg:py-24">
      <div className="mb-10 flex flex-col items-center gap-3.5 text-center lg:mb-14">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-[#4d7a08]">{t("label")}</div>
        <h2 className="max-w-[640px] font-display text-[30px] font-extrabold leading-[1.08] tracking-tight text-[#111c0a] text-balance sm:text-[36px] lg:text-[44px]">
          {t("title")}
        </h2>
        <p className="max-w-[480px] text-[16px] font-light leading-relaxed text-[#55664c] text-pretty">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Booking page + poster */}
        <article className="flex min-w-0 flex-wrap items-center gap-8 overflow-hidden rounded-3xl bg-[#111c0a] p-7 text-white sm:p-9 md:col-span-2">
          <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3">
            <Title big>{t("page.title")}</Title>
            <p className="max-w-[340px] text-[14px] leading-relaxed text-[#c9d4c1]">{t("page.body")}</p>
            <span className="mt-2 inline-flex max-w-full items-center gap-2.5 self-start rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-2.5 text-[13px] text-[#e4f7b8]">
              <Link2 size={15} className="shrink-0 text-[#a8d832]" aria-hidden="true" />
              <span className="truncate">
                {host}/clubs/{CLUB_SLUG}
              </span>
            </span>
          </div>
          <div className="flex flex-[0_1_260px] justify-center py-2">
            <div className="flex w-[210px] rotate-[4deg] flex-col items-center gap-3 rounded-[10px] bg-[#fbfcf7] px-5 py-[22px] text-center text-[#111c0a] shadow-[0_30px_50px_-20px_rgba(0,0,0,0.6)]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4d7a08]">{CLUB}</span>
              <span className="font-display text-[22px] font-extrabold leading-[1.05]">{t("page.poster")}</span>
              <span className="grid size-28 place-items-center rounded-[10px] bg-[#111c0a]">
                <QrMark />
              </span>
              <span className="text-[11px] text-[#3d4f35]">{t("page.scan")}</span>
            </div>
          </div>
        </article>

        {/* Weekly regulars */}
        <article className="flex min-w-0 flex-col gap-[18px] rounded-3xl border border-[#e8ede4] bg-white p-7 sm:p-[30px]">
          <div className="flex flex-col gap-2">
            <Title>{t("weekly.title")}</Title>
            <p className="text-[14px] leading-relaxed text-[#55664c]">{t("weekly.body")}</p>
          </div>
          <ul className="mt-auto flex flex-col gap-1.5">
            {weeks.map(({ date, skipped }) => (
              <li
                key={date.toISOString()}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[13px] ${
                  skipped ? "bg-[#f4f6f2] text-[#55664c]" : "bg-[#f3fbde] text-[#111c0a]"
                }`}
              >
                <span>
                  <strong className={`font-semibold ${skipped ? "line-through" : ""}`}>{day(date)}</strong> · 19:00
                </span>
                <span className={`text-[12px] ${skipped ? "" : "font-semibold text-[#2e4d03]"}`}>
                  {skipped ? t("weekly.skipped") : t("weekly.booked")}
                </span>
              </li>
            ))}
          </ul>
        </article>

        {/* Staff */}
        <article className="flex min-w-0 flex-col gap-[18px] rounded-3xl border border-[#e8ede4] bg-[#f8f9f7] p-7 sm:p-[30px]">
          <div className="flex flex-col gap-2">
            <Title>{t("staff.title")}</Title>
            <p className="text-[14px] leading-relaxed text-[#55664c]">{t("staff.body")}</p>
          </div>
          <ul className="mt-auto flex flex-col gap-2">
            {[
              { initial: "D", name: "Daniel", role: t("staff.owner"), dark: true },
              { initial: "S", name: "Sara", role: t("staff.staff"), dark: false },
            ].map((p) => (
              <li key={p.name} className="flex items-center gap-2.5 rounded-2xl border border-[#e8ede4] bg-white px-3 py-2.5">
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                    p.dark ? "bg-[#111c0a] text-white" : "bg-[#a8d832] text-[#111c0a]"
                  }`}
                >
                  {p.initial}
                </span>
                <span className="min-w-0 text-[13px] font-semibold">
                  {p.name}
                  <span className="block text-[12px] font-normal text-[#55664c]">{p.role}</span>
                </span>
              </li>
            ))}
            <li className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-[#d0d9c9] px-3 py-2.5 text-[13px] text-[#3d4f35]">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e8ede4]">
                <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <span className="min-w-0 break-words">{t("staff.invited", { email: STAFF_EMAIL })}</span>
            </li>
          </ul>
        </article>

        {/* Reminders */}
        <article className="flex min-w-0 flex-col gap-[18px] rounded-3xl border border-[#e8ede4] bg-white p-7 sm:p-[30px]">
          <div className="flex flex-col gap-2">
            <Title>{t("reminders.title")}</Title>
            <p className="text-[14px] leading-relaxed text-[#55664c]">{t("reminders.body")}</p>
          </div>
          <div className="mt-auto overflow-hidden rounded-2xl border border-[#e8ede4]">
            <div className="flex justify-between gap-3 border-b border-[#e8ede4] bg-[#f8f9f7] px-3.5 py-3 text-[12px] text-[#55664c]">
              <span className="min-w-0 truncate">
                <strong className="font-semibold text-[#111c0a]">{CLUB}</strong> · Kortello
              </span>
              <span className="shrink-0">09:00</span>
            </div>
            <div className="flex flex-col gap-1.5 p-3.5">
              <span className="text-[15px] font-semibold">{t("reminders.subject")}</span>
              <span className="text-[13px] text-[#55664c]">
                {t("reminders.court", { n: 3 })} · {reminderDay} 10:00 · 90 min
              </span>
              <span className="mt-1.5 self-start rounded-full bg-[#e1eaff] px-2.5 py-1 text-[11px] font-semibold text-[#17327f]">
                {t("reminders.sent")}
              </span>
            </div>
          </div>
        </article>

        {/* No-shows */}
        <article className="flex min-w-0 flex-col gap-[18px] rounded-3xl border border-[#e8ede4] bg-white p-7 sm:p-[30px]">
          <div className="flex flex-col gap-2">
            <Title>{t("noShows.title")}</Title>
            <p className="text-[14px] leading-relaxed text-[#55664c]">{t("noShows.body")}</p>
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-[#e8ede4] px-3 py-[11px] text-[13px]">
              <span className="font-semibold">Lucas M.</span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                {t("noShows.count", { n: 1 })}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-[#e8ede4] px-3 py-[11px] text-[13px]">
              <span className="font-semibold">Noah K.</span>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                {t("noShows.count", { n: 2 })} · {t("noShows.paused")}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 px-1 pt-1 text-[12px] text-[#55664c]">
              <span>{t("noShows.pauseAfter")}</span>
              <span className="shrink-0 rounded-lg bg-[#f4f6f2] px-2.5 py-1 font-semibold text-[#111c0a]">
                {t("noShows.count", { n: 2 })}
              </span>
            </div>
          </div>
        </article>

        {/* Tournaments */}
        <article className="flex min-w-0 flex-wrap items-center gap-8 rounded-3xl border border-[#e3eed3] bg-[#f3f8ec] p-7 sm:p-9 md:col-span-2">
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-3">
            <Title big>{t("tournament.title")}</Title>
            <p className="max-w-[320px] text-[14px] leading-relaxed text-[#3d4f35]">{t("tournament.body")}</p>
          </div>
          <div aria-hidden="true" className="flex min-w-0 flex-[1_1_340px] flex-col gap-5 sm:flex-row sm:items-center sm:gap-3.5">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4d7a08]">{t("tournament.semis")}</span>
              {[
                [
                  { name: "Emma L.", won: true },
                  { name: "Lucas M.", score: "6-4 6-3" },
                ],
                [
                  { name: "Noah K.", score: "7-6 3-6 8-10" },
                  { name: "Sofia R.", won: true },
                ],
              ].map((match, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-[#e3eed3] bg-white text-[12px]">
                  {match.map((p, j) => (
                    <div
                      key={p.name}
                      className={`flex justify-between gap-2 px-2.5 py-2 ${j ? "border-t border-[#eef3e6]" : ""} ${
                        p.won ? "font-semibold" : "text-[#6e7f65]"
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {p.won ? (
                        <span className="size-[7px] shrink-0 self-center rounded-full bg-[#7aad12]" />
                      ) : (
                        <span className="shrink-0">{p.score}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <svg width="26" height="130" viewBox="0 0 26 130" className="hidden shrink-0 sm:block">
              <path d="M0 34 H12 V96 H0 M12 65 H26" fill="none" stroke="#b9cfa0" strokeWidth="1.5" />
            </svg>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4d7a08]">
                {t("tournament.final", { day: finalDay })}
              </span>
              <div className="overflow-hidden rounded-xl border-[1.5px] border-[#111c0a] bg-white text-[12px] font-semibold">
                <div className="px-2.5 py-2">Emma L.</div>
                <div className="border-t border-[#eef3e6] px-2.5 py-2">Sofia R.</div>
              </div>
              <span className="self-start rounded-full bg-[#111c0a] px-2.5 py-1 text-[11px] font-semibold text-[#a8d832]">
                {t("tournament.size", { players: 8, rounds: 3 })}
              </span>
            </div>
          </div>
        </article>

        {/* Data export */}
        <article className="flex min-w-0 flex-col gap-[18px] rounded-3xl border border-[#e8ede4] bg-white p-7 sm:p-[30px]">
          <div className="flex flex-col gap-2">
            <Title>{t("data.title")}</Title>
            <p className="text-[14px] leading-relaxed text-[#55664c]">{t("data.body")}</p>
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <div className="overflow-hidden rounded-2xl border border-[#e8ede4] text-[11px] text-[#3d4f35]">
              <div className="grid grid-cols-4 gap-1.5 bg-[#f4f6f2] px-2.5 py-2 font-semibold">
                <span>{t("data.date")}</span>
                <span>{t("data.court")}</span>
                <span>{t("data.player")}</span>
                <span className="text-right">{t("data.price")}</span>
              </div>
              {[
                { court: 2, player: "Emma L.", price: 12 },
                { court: 1, player: "Lucas M.", price: 10 },
              ].map((r) => (
                <div key={r.player} className="grid grid-cols-4 gap-1.5 border-t border-[#eef1ea] px-2.5 py-2">
                  <span>{format(firstTuesday, "d MMM", { locale: df })}</span>
                  <span>{t("reminders.court", { n: r.court })}</span>
                  <span className="truncate">{r.player}</span>
                  <span className="text-right">€{r.price}</span>
                </div>
              ))}
            </div>
            <span className="inline-flex min-h-10 items-center gap-2 self-start rounded-[10px] border border-[#d0d9c9] bg-[#f4f6f2] px-3.5 text-[13px] font-medium text-[#111c0a]">
              <Download size={14} strokeWidth={2.2} aria-hidden="true" />
              {CLUB_SLUG}-bookings.csv
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}
