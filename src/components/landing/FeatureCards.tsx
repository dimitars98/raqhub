import { addDays, format, nextTuesday, subDays } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Copy, Download, Mail, Repeat, UserPlus } from "lucide-react";
import { dateLocale } from "@/lib/dateLocale";
import { makeLabels } from "@/lib/labels";
import { BADGE, BOOKING_STATUS_TONE, NEUTRAL_TONE } from "@/lib/badges";
import { NO_SHOW_DAYS } from "@/lib/bookingRules";

// "Built for clubs": what RaqHub does around a booking that the Features
// rows above don't cover. Each card shows a small copy of the real screen,
// with the app's own texts and styles: the Share page and the printed poster,
// Bookings, Staff, the reminder email, the no-show setting, the tournament
// draw and Settings → Your data. The club and people in it are made up.

const CLUB = "Larkspur Tennis Club";
const CITY = "Skopje";
const CLUB_SLUG = "larkspur-tennis";
const STAFF_DOMAIN = "larkspurtc.com";

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

/** Title and text of a white card. */
function CardText({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Title>{title}</Title>
      <p className="text-[14px] leading-relaxed text-[#55664c]">{body}</p>
    </div>
  );
}

/** A real QR code for the example club's link (made once with the qrcode package). */
const QR_PATH =
  "M0 0h7v1H0zM9 0h1v1H9zM11 0h1v1H11zM16 0h1v1H16zM18 0h2v1H18zM21 0h1v1H21zM23 0h1v1H23zM26 0h7v1H26zM0 1h1v1H0zM6 1h1v1H6zM9 1h3v1H9zM15 1h1v1H15zM18 1h1v1H18zM21 1h1v1H21zM26 1h1v1H26zM32 1h1v1H32zM0 2h1v1H0zM2 2h3v1H2zM6 2h1v1H6zM8 2h1v1H8zM10 2h2v1H10zM14 2h3v1H14zM19 2h4v1H19zM26 2h1v1H26zM28 2h3v1H28zM32 2h1v1H32zM0 3h1v1H0zM2 3h3v1H2zM6 3h1v1H6zM8 3h4v1H8zM18 3h2v1H18zM21 3h1v1H21zM24 3h1v1H24zM26 3h1v1H26zM28 3h3v1H28zM32 3h1v1H32zM0 4h1v1H0zM2 4h3v1H2zM6 4h1v1H6zM8 4h3v1H8zM12 4h1v1H12zM14 4h4v1H14zM20 4h3v1H20zM26 4h1v1H26zM28 4h3v1H28zM32 4h1v1H32zM0 5h1v1H0zM6 5h1v1H6zM8 5h3v1H8zM17 5h1v1H17zM19 5h1v1H19zM23 5h2v1H23zM26 5h1v1H26zM32 5h1v1H32zM0 6h7v1H0zM8 6h1v1H8zM10 6h1v1H10zM12 6h1v1H12zM14 6h1v1H14zM16 6h1v1H16zM18 6h1v1H18zM20 6h1v1H20zM22 6h1v1H22zM24 6h1v1H24zM26 6h7v1H26zM8 7h1v1H8zM10 7h1v1H10zM14 7h1v1H14zM16 7h1v1H16zM19 7h3v1H19zM23 7h1v1H23zM0 8h1v1H0zM2 8h5v1H2zM9 8h1v1H9zM13 8h2v1H13zM17 8h1v1H17zM19 8h1v1H19zM23 8h1v1H23zM26 8h5v1H26zM0 9h1v1H0zM3 9h1v1H3zM5 9h1v1H5zM10 9h2v1H10zM13 9h2v1H13zM16 9h5v1H16zM23 9h1v1H23zM26 9h2v1H26zM29 9h4v1H29zM2 10h1v1H2zM6 10h2v1H6zM10 10h2v1H10zM13 10h5v1H13zM20 10h1v1H20zM22 10h1v1H22zM24 10h2v1H24zM28 10h1v1H28zM30 10h2v1H30zM2 11h1v1H2zM4 11h2v1H4zM10 11h1v1H10zM12 11h2v1H12zM16 11h3v1H16zM20 11h1v1H20zM24 11h2v1H24zM28 11h5v1H28zM0 12h5v1H0zM6 12h2v1H6zM9 12h1v1H9zM11 12h1v1H11zM14 12h1v1H14zM16 12h1v1H16zM20 12h6v1H20zM27 12h3v1H27zM1 13h1v1H1zM3 13h2v1H3zM7 13h3v1H7zM11 13h1v1H11zM15 13h1v1H15zM18 13h1v1H18zM24 13h1v1H24zM26 13h1v1H26zM30 13h3v1H30zM2 14h1v1H2zM4 14h1v1H4zM6 14h1v1H6zM12 14h1v1H12zM15 14h4v1H15zM20 14h1v1H20zM22 14h1v1H22zM25 14h3v1H25zM30 14h2v1H30zM0 15h2v1H0zM4 15h1v1H4zM8 15h1v1H8zM10 15h1v1H10zM13 15h1v1H13zM15 15h1v1H15zM21 15h1v1H21zM23 15h4v1H23zM29 15h2v1H29zM2 16h3v1H2zM6 16h4v1H6zM11 16h1v1H11zM13 16h1v1H13zM15 16h1v1H15zM17 16h1v1H17zM22 16h1v1H22zM24 16h2v1H24zM27 16h3v1H27zM32 16h1v1H32zM2 17h1v1H2zM5 17h1v1H5zM7 17h1v1H7zM10 17h2v1H10zM13 17h1v1H13zM18 17h4v1H18zM23 17h1v1H23zM25 17h3v1H25zM29 17h4v1H29zM6 18h2v1H6zM9 18h1v1H9zM11 18h2v1H11zM15 18h2v1H15zM18 18h1v1H18zM20 18h2v1H20zM25 18h4v1H25zM30 18h2v1H30zM4 19h2v1H4zM7 19h4v1H7zM12 19h2v1H12zM19 19h4v1H19zM24 19h1v1H24zM26 19h7v1H26zM0 20h1v1H0zM3 20h1v1H3zM6 20h3v1H6zM10 20h1v1H10zM15 20h1v1H15zM18 20h2v1H18zM21 20h1v1H21zM25 20h1v1H25zM28 20h2v1H28zM32 20h1v1H32zM0 21h1v1H0zM2 21h2v1H2zM5 21h1v1H5zM7 21h2v1H7zM11 21h1v1H11zM15 21h3v1H15zM20 21h4v1H20zM26 21h1v1H26zM29 21h2v1H29zM32 21h1v1H32zM0 22h1v1H0zM3 22h1v1H3zM5 22h2v1H5zM8 22h7v1H8zM19 22h1v1H19zM29 22h3v1H29zM0 23h1v1H0zM2 23h2v1H2zM8 23h4v1H8zM13 23h2v1H13zM16 23h1v1H16zM18 23h5v1H18zM24 23h1v1H24zM26 23h1v1H26zM28 23h5v1H28zM0 24h1v1H0zM4 24h1v1H4zM6 24h2v1H6zM9 24h2v1H9zM12 24h1v1H12zM16 24h2v1H16zM19 24h1v1H19zM22 24h8v1H22zM32 24h1v1H32zM8 25h1v1H8zM14 25h1v1H14zM16 25h2v1H16zM19 25h1v1H19zM23 25h2v1H23zM28 25h1v1H28zM30 25h1v1H30zM32 25h1v1H32zM0 26h7v1H0zM13 26h1v1H13zM15 26h1v1H15zM17 26h1v1H17zM20 26h1v1H20zM22 26h3v1H22zM26 26h1v1H26zM28 26h1v1H28zM30 26h2v1H30zM0 27h1v1H0zM6 27h1v1H6zM8 27h4v1H8zM14 27h1v1H14zM17 27h2v1H17zM20 27h1v1H20zM23 27h2v1H23zM28 27h3v1H28zM32 27h1v1H32zM0 28h1v1H0zM2 28h3v1H2zM6 28h1v1H6zM8 28h2v1H8zM11 28h1v1H11zM15 28h2v1H15zM19 28h4v1H19zM24 28h6v1H24zM0 29h1v1H0zM2 29h3v1H2zM6 29h1v1H6zM8 29h1v1H8zM10 29h4v1H10zM15 29h1v1H15zM18 29h1v1H18zM23 29h3v1H23zM28 29h1v1H28zM30 29h1v1H30zM32 29h1v1H32zM0 30h1v1H0zM2 30h3v1H2zM6 30h1v1H6zM8 30h1v1H8zM11 30h2v1H11zM15 30h2v1H15zM20 30h1v1H20zM22 30h1v1H22zM24 30h1v1H24zM26 30h2v1H26zM0 31h1v1H0zM6 31h1v1H6zM9 31h1v1H9zM12 31h2v1H12zM15 31h1v1H15zM21 31h2v1H21zM25 31h2v1H25zM28 31h1v1H28zM30 31h1v1H30zM0 32h7v1H0zM8 32h2v1H8zM12 32h2v1H12zM15 32h1v1H15zM17 32h1v1H17zM22 32h3v1H22zM26 32h2v1H26zM31 32h1v1H31z";

function QrMark() {
  return (
    <svg viewBox="0 0 33 33" fill="#111c0a" shapeRendering="crispEdges" className="h-auto w-full">
      <path d={QR_PATH} />
    </svg>
  );
}

/** A player's initials on a colour, like the app's Avatar. */
function Initials({ name, tone }: { name: string; tone: string }) {
  const letters = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${tone}`}>
      {letters}
    </span>
  );
}

/** One player's line in a draw match, as in Bracket.tsx. */
function Side({ name, state }: { name: string; state: "won" | "lost" | "open" }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 text-[13px] ${
        state === "won" ? "font-semibold text-ink-900" : state === "lost" ? "text-ink-400" : "text-ink-600"
      }`}
    >
      <span className="truncate">{name}</span>
      {state === "won" && <span className="size-2 shrink-0 rounded-full bg-brand-600" />}
    </div>
  );
}

export default function FeatureCards() {
  const t = useTranslations("featureCards");
  const ts = useTranslations("share");
  const tp = useTranslations("share.poster");
  const tb = useTranslations("adminBookings");
  const tst = useTranslations("staff");
  const te = useTranslations("emails");
  const tset = useTranslations("settingsPage");
  const tt = useTranslations("tournaments");
  const labels = makeLabels(useTranslations("labels"));
  const locale = useLocale();
  const df = dateLocale(locale);

  // Example dates that are always in the near future.
  const today = new Date();
  const firstTuesday = nextTuesday(today);
  const takenWeek = addDays(firstTuesday, 14);
  const tomorrow = addDays(today, 1);
  const link = `raqhub.com/${locale}/clubs/${CLUB_SLUG}`;
  const court = (n: number) => t("reminders.court", { n });
  const bookingDate = (d: Date, time: string) => `${format(d, "EEE d MMM", { locale: df })}, ${time}`;

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
        {/* Booking page + poster: the Share page's link box, and the printed poster */}
        <article className="flex min-w-0 flex-wrap items-center gap-8 overflow-hidden rounded-3xl bg-[#111c0a] p-7 text-white sm:p-9 md:col-span-2">
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
            <Title big>{t("page.title")}</Title>
            <p className="max-w-[360px] text-[14px] leading-relaxed text-[#c9d4c1]">{t("page.body")}</p>
            <div aria-hidden="true" className="mt-3 rounded-2xl border border-ink-100 bg-white p-4 text-ink-900">
              <p className="text-[13px] font-semibold">{ts("linkTitle")}</p>
              <p className="mt-0.5 text-[12px] text-ink-600">{ts("linkBody")}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate rounded-xl border border-ink-200 px-3 py-2 font-mono text-[12px]">
                  {link}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink-900 px-3.5 py-2 text-[12px] font-medium text-white">
                  <Copy size={13} />
                  {ts("copyLink")}
                </span>
              </div>
            </div>
          </div>
          <div aria-hidden="true" className="flex flex-[0_1_250px] justify-center py-2">
            <div className="flex w-[230px] rotate-[3deg] flex-col items-center bg-white px-5 pb-4 pt-5 text-center text-ink-900 shadow-[0_30px_50px_-20px_rgba(0,0,0,0.6)]">
              <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-brand-600">
                {CLUB} · {CITY}
              </span>
              <span className="mt-2.5 font-display text-[19px] font-extrabold leading-[1.05] tracking-tight">
                {tp("title")}
              </span>
              <span className="mt-2 text-[9px] leading-snug text-ink-600">{tp("body")}</span>
              <span className="my-3.5 w-[104px]">
                <QrMark />
              </span>
              <span className="grid w-full grid-cols-3 gap-1.5 text-[8px] leading-tight text-ink-800">
                {(["step1", "step2", "step3"] as const).map((step, i) => (
                  <span key={step} className="flex flex-col items-center gap-1">
                    <span className="grid size-4 place-items-center rounded-full bg-brand-100 text-[8px] font-bold text-brand-900">
                      {i + 1}
                    </span>
                    {tp(step)}
                  </span>
                ))}
              </span>
              <span className="mt-3 text-[7px] text-ink-400">{tp("orVisit")}</span>
              <span className="max-w-full truncate font-mono text-[8px] text-ink-800">{link}</span>
              <span className="mt-2 text-[7px] text-ink-400">RaqHub</span>
            </div>
          </div>
        </article>

        {/* Weekly regulars: the notice Bookings shows after adding a weekly booking */}
        <article className="flex min-w-0 flex-col gap-[18px] rounded-3xl border border-[#e8ede4] bg-white p-7 sm:p-[30px]">
          <CardText title={t("weekly.title")} body={t("weekly.body")} />
          <div aria-hidden="true" className="mt-auto flex flex-col gap-2">
            <div className="flex items-start gap-2.5 rounded-xl border border-[#d6f09a] bg-[#f3fbde] px-3 py-2.5 text-[12px] text-[#2e4d03]">
              <Repeat size={14} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">{tb("addedSeries", { n: 3 })}</p>
                <p className="mt-0.5 text-[#4d7a08]">
                  {tb("skippedWeeks", { dates: format(takenWeek, "EEE d MMM", { locale: df }) })}
                </p>
              </div>
            </div>
            {[firstTuesday, addDays(firstTuesday, 7)].map((d, i) => (
              <div key={i} className="rounded-2xl border border-[#e8ede4] bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-[#111c0a]">Emma Lazarova</div>
                    <div className="font-mono text-[11px] text-[#7aad12]">RH-4K{7 + i}Q</div>
                  </div>
                  <span className={`${BADGE} ${BOOKING_STATUS_TONE.confirmed} shrink-0`}>
                    {labels.bookingStatus("confirmed")}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#3d4f35]">
                  <span>
                    {court(2)} · {bookingDate(d, "19:00")}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f3fbde] px-2 py-0.5 text-[11px] font-medium text-[#4d7a08]">
                    <Repeat size={11} /> {tb("weekly")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Staff: the invite box and the list from the Staff page */}
        <article className="flex min-w-0 flex-col gap-[18px] rounded-3xl border border-[#e8ede4] bg-[#f8f9f7] p-7 sm:p-[30px]">
          <CardText title={t("staff.title")} body={t("staff.body")} />
          <div aria-hidden="true" className="mt-auto flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-2xl border border-ink-100 bg-white p-2.5">
              <span className="min-w-0 flex-1 truncate rounded-xl border border-ink-200 px-3 py-2 text-[12px] text-ink-400">
                {tst("emailPlaceholder")}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink-900 px-3 py-2 text-[12px] font-medium text-white">
                <UserPlus size={13} />
                {tst("invite")}
              </span>
            </div>
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white">
              <li className="flex items-center gap-2.5 px-3 py-3">
                <Initials name="Sara Mitrevska" tone="bg-brand-100 text-brand-900" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink-900">Sara Mitrevska</p>
                  <p className="truncate text-[11px] text-ink-400">
                    {tst("joined", { date: format(subDays(today, 24), "d MMM yyyy", { locale: df }) })}
                  </p>
                </div>
                <span className={`${BADGE} shrink-0 bg-brand-100 text-brand-900`}>{tst("active")}</span>
              </li>
              <li className="flex items-center gap-2.5 px-3 py-3">
                <Initials name="Marko Petrov" tone="bg-court-100 text-court-800" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink-900">Marko Petrov</p>
                  <p className="truncate text-[11px] text-ink-400">
                    {tst("joined", { date: format(subDays(today, 9), "d MMM yyyy", { locale: df }) })}
                  </p>
                </div>
                <span className={`${BADGE} shrink-0 bg-brand-100 text-brand-900`}>{tst("active")}</span>
              </li>
              <li className="flex items-center gap-2.5 px-3 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-50 text-ink-400">
                  <Mail size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink-900">coach@{STAFF_DOMAIN}</p>
                  <p className="truncate text-[11px] text-ink-400">
                    {tst("invitedOn", { date: format(subDays(today, 1), "d MMM yyyy", { locale: df }) })}
                  </p>
                </div>
                <span className={`${BADGE} shrink-0 ${NEUTRAL_TONE}`}>{tst("pending")}</span>
              </li>
            </ul>
          </div>
        </article>

        {/* Reminders: the real reminder email */}
        <article className="flex min-w-0 flex-col gap-[18px] rounded-3xl border border-[#e8ede4] bg-white p-7 sm:p-[30px]">
          <CardText title={t("reminders.title")} body={t("reminders.body")} />
          <div aria-hidden="true" className="mt-auto rounded-2xl bg-[#f4f6f2] p-3">
            <p className="truncate px-1 pb-2 text-[11px] text-[#6e7f65]">
              <strong className="font-semibold text-[#111c0a]">{CLUB}</strong> ·{" "}
              {te("reminder.subject", {
                what: court(3),
                date: format(tomorrow, "EEEE d MMMM", { locale: df }),
                time: "10:00",
              })}
            </p>
            <div className="rounded-xl border border-[#e8ede4] bg-white p-4">
              <p className="text-[15px] font-bold text-[#111c0a]">{te("greeting", { name: "Emma" })}</p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#3d4f35]">{te("reminder.intro")}</p>
              <dl className="mt-2.5 border-t border-[#e8ede4] text-[12px]">
                {(
                  [
                    [te("labels.what"), court(3)],
                    [te("labels.when"), `${format(tomorrow, "EEE d MMM", { locale: df })}, 10:00–11:30`],
                    [te("labels.duration"), te("minutes", { n: 90 })],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex gap-3 py-1.5">
                    <dt className="w-[34%] shrink-0 text-[#6e7f65]">{label}</dt>
                    <dd className="min-w-0 font-semibold text-[#111c0a]">{value}</dd>
                  </div>
                ))}
              </dl>
              <span className="mt-3 inline-block rounded-full bg-[#111c0a] px-4 py-2 text-[12px] font-semibold text-white">
                {te("viewBookings")}
              </span>
            </div>
          </div>
        </article>

        {/* No-shows: the setting, and how players show up in Bookings */}
        <article className="flex min-w-0 flex-col gap-[18px] rounded-3xl border border-[#e8ede4] bg-white p-7 sm:p-[30px]">
          <CardText title={t("noShows.title")} body={t("noShows.body")} />
          <div aria-hidden="true" className="mt-auto flex flex-col gap-2">
            <div className="flex flex-col gap-1.5 pb-1">
              <span className="text-[13px] font-medium text-[#3d4f35]">{tset("repeatNoShows")}</span>
              <span className="flex h-10 items-center justify-between gap-2 rounded-xl border border-ink-200 bg-white pl-3.5 pr-3 text-[13px] text-ink-900">
                <span className="truncate">{tset("pauseAfter", { n: 2 })}</span>
                <ChevronDown size={15} className="shrink-0 text-ink-400" />
              </span>
              <span className="text-[12px] text-[#6e7f65]">{tset("noShowHelp", { days: NO_SHOW_DAYS })}</span>
            </div>
            {[
              { name: "Lucas Markovski", count: 1, paused: false },
              { name: "Noah Kostov", count: 2, paused: true },
            ].map((p) => (
              <div key={p.name} className="flex items-start justify-between gap-2 rounded-2xl border border-[#e8ede4] bg-white p-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-[#111c0a]">{p.name}</div>
                  <div
                    className={`mt-1 inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      p.paused ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {tb("noShowCount", { n: p.count })}
                    {p.paused && <> · {tb("paused")}</>}
                  </div>
                </div>
                <span className={`${BADGE} ${BOOKING_STATUS_TONE.no_show} shrink-0`}>
                  {labels.bookingStatus("no_show")}
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Tournaments: the knockout draw, as on the tournament page */}
        <article className="flex min-w-0 flex-wrap items-center gap-8 rounded-3xl border border-[#e3eed3] bg-[#f3f8ec] p-7 sm:p-9 md:col-span-2">
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-3">
            <Title big>{t("tournament.title")}</Title>
            <p className="max-w-[320px] text-[14px] leading-relaxed text-[#3d4f35]">{t("tournament.body")}</p>
          </div>
          <div aria-hidden="true" className="flex min-w-0 flex-[1_1_340px] gap-4 sm:gap-6">
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{tt("rounds.semi")}</p>
              <div className="flex flex-col gap-3">
                {[
                  { a: "Emma Lazarova", b: "Lucas Markovski", score: "6-4 6-3", aWon: true },
                  { a: "Noah Kostov", b: "Sofia Ristova", score: "7-6 3-6 10-8", aWon: false },
                ].map((m) => (
                  <div key={m.a} className="overflow-hidden rounded-xl border border-ink-100 bg-white">
                    <Side name={m.a} state={m.aWon ? "won" : "lost"} />
                    <div className="h-px bg-ink-100" />
                    <Side name={m.b} state={m.aWon ? "lost" : "won"} />
                    <div className="border-t border-ink-100 px-3 py-1.5 text-[11px] text-ink-400">{m.score}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{tt("rounds.final")}</p>
              <div className="flex flex-1 flex-col justify-around">
                <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
                  <Side name="Emma Lazarova" state="open" />
                  <div className="h-px bg-ink-100" />
                  <Side name="Sofia Ristova" state="open" />
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Data export: Settings → Your data */}
        <article className="flex min-w-0 flex-col gap-[18px] rounded-3xl border border-[#e8ede4] bg-white p-7 sm:p-[30px]">
          <CardText title={t("data.title")} body={t("data.body")} />
          <div aria-hidden="true" className="mt-auto flex flex-col gap-2">
            {(
              [
                [tset("data.bookings"), tset("data.bookingsDesc")],
                [tset("data.members"), tset("data.membersDesc")],
              ] as const
            ).map(([title, desc]) => (
              <div key={title} className="flex flex-col gap-2.5 rounded-xl border border-[#e8ede4] bg-white p-3.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#111c0a]">{title}</p>
                  <p className="mt-0.5 text-[12px] text-[#6e7f65]">{desc}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[#d0d9c9] bg-[#f4f6f2] px-3.5 py-1.5 text-[12px] font-medium text-[#3d4f35]">
                  <Download size={13} /> {tset("data.download")}
                </span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
