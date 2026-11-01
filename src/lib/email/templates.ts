import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import mk from "@/messages/mk.json";
import sq from "@/messages/sq.json";
import de from "@/messages/de.json";
import fr from "@/messages/fr.json";
import it from "@/messages/it.json";
import sr from "@/messages/sr.json";
import type { Locale } from "./locale";
import { PLANS, SUPPORT_EMAIL, type PlanId } from "@/lib/plans";
import { intlLocale } from "@/lib/dateLocale";
import type { ClosureReason } from "@/lib/closures";

const MESSAGES = { en, mk, sq, de, fr, it, sr } as const;
const TIME_ZONE = "Europe/Skopje";

type Rendered = { subject: string; html: string; text: string };

function translator(locale: Locale) {
  return createTranslator({
    locale,
    messages: MESSAGES[locale] as typeof en,
    namespace: "emails",
  });
}

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function formatters(locale: Locale) {
  const intl = intlLocale(locale);
  const date = new Intl.DateTimeFormat(intl, {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = new Intl.DateTimeFormat(intl, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = new Intl.DateTimeFormat(intl, {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return {
    date: (d: string | Date) => date.format(new Date(d)),
    time: (d: string | Date) => time.format(new Date(d)),
    day: (d: string | Date) => day.format(new Date(d)),
    money: (n: number) => `€${n.toFixed(2)}`,
  };
}

/** The shared frame every email sits in: logo, card, footer. Plain tables for email apps. */
function layout(opts: {
  heading: string;
  intro: string;
  rows?: [string, string][];
  extraHtml?: string;
  button?: { label: string; url: string };
  footer: string;
  /** Adds RaqHub's support address under the footer (emails to club owners and staff). */
  support?: boolean;
}) {
  const rows = (opts.rows ?? [])
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#6e7f65;font-size:14px;width:40%;vertical-align:top">${esc(label)}</td>
          <td style="padding:8px 0;color:#111c0a;font-size:14px;font-weight:600">${esc(value)}</td>
        </tr>`,
    )
    .join("");

  const button = opts.button
    ? `<p style="margin:28px 0 4px">
        <a href="${esc(opts.button.url)}" style="display:inline-block;background:#111c0a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">${esc(opts.button.label)}</a>
      </p>`
    : "";

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f6f2;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f2;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="padding:0 4px 16px;font-size:20px;font-weight:700;color:#111c0a">Raq<span style="color:#7aad12">Hub</span></td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e8ede4;border-radius:16px;padding:28px">
          <h1 style="margin:0 0 10px;font-size:20px;line-height:1.3;color:#111c0a">${esc(opts.heading)}</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#3d4f35">${esc(opts.intro)}</p>
          ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8ede4">${rows}</table>` : ""}
          ${opts.extraHtml ?? ""}
          ${button}
        </td></tr>
        <tr><td style="padding:16px 4px;font-size:12px;line-height:1.5;color:#6e7f65">${esc(opts.footer)}${
          opts.support
            ? `<br><a href="mailto:${SUPPORT_EMAIL}" style="color:#6e7f65">${SUPPORT_EMAIL}</a>`
            : ""
        }</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function plainText(heading: string, intro: string, rows: [string, string][] = [], link?: string, footer?: string) {
  return [
    heading,
    "",
    intro,
    "",
    ...rows.map(([l, v]) => `${l}: ${v}`),
    link ? `\n${link}` : "",
    footer ? `\n--\n${footer}` : "",
  ]
    .join("\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export type BookingEmailData = {
  locale: Locale;
  name: string | null;
  /** Court name, or null for a lesson. */
  courtName: string | null;
  coachName: string | null;
  clubName: string;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  totalPrice: number;
  reference: string;
  appUrl: string;
};

function bookingParts(kind: "confirmed" | "cancelled" | "reminder", b: BookingEmailData): Rendered {
  const t = translator(b.locale);
  const f = formatters(b.locale);
  // A lesson names the coach, and the court when it has one.
  const what = b.coachName
    ? [t("lessonWith", { name: b.coachName }), b.courtName].filter(Boolean).join(" · ")
    : (b.courtName ?? "");
  const when = `${f.date(b.startsAt)}, ${f.time(b.startsAt)}–${f.time(b.endsAt)}`;

  const subject = t(`${kind}.subject`, { what, date: f.date(b.startsAt), time: f.time(b.startsAt) });
  const heading = b.name ? t("greeting", { name: b.name }) : t("greetingNoName");
  const intro = t(`${kind}.intro`);
  const rows: [string, string][] = [
    [t("labels.what"), what],
    [t("labels.club"), b.clubName],
    [t("labels.when"), when],
    [t("labels.duration"), t("minutes", { n: b.durationMin })],
    [t("labels.price"), f.money(b.totalPrice)],
    [t("labels.reference"), b.reference],
  ];
  const url = `${b.appUrl}/${b.locale}/my-bookings`;
  const footer = t("footerPlayer", { club: b.clubName });

  return {
    subject,
    html: layout({ heading, intro, rows, button: { label: t("viewBookings"), url }, footer }),
    text: plainText(heading, intro, rows, url, footer),
  };
}

export const bookingConfirmedEmail = (b: BookingEmailData) => bookingParts("confirmed", b);
export const bookingCancelledEmail = (b: BookingEmailData) => bookingParts("cancelled", b);
export const bookingReminderEmail = (b: BookingEmailData) => bookingParts("reminder", b);

/** The club closed the court at the booking's time, so the booking is cancelled. */
export function courtClosedEmail(
  b: BookingEmailData & { reason: ClosureReason; note: string | null },
): Rendered {
  const t = translator(b.locale);
  const f = formatters(b.locale);
  const what = b.coachName
    ? [t("lessonWith", { name: b.coachName }), b.courtName].filter(Boolean).join(" · ")
    : (b.courtName ?? "");
  const when = `${f.date(b.startsAt)}, ${f.time(b.startsAt)}–${f.time(b.endsAt)}`;
  const heading = b.name ? t("greeting", { name: b.name }) : t("greetingNoName");
  const intro = t("closed.intro", { club: b.clubName });
  const reason = [t(`closed.reasons.${b.reason}`), b.note].filter(Boolean).join(": ");
  const rows: [string, string][] = [
    [t("labels.what"), what],
    [t("labels.club"), b.clubName],
    [t("labels.when"), when],
    [t("closed.reason"), reason],
    [t("labels.reference"), b.reference],
  ];
  const url = `${b.appUrl}/${b.locale}/my-bookings`;
  const footer = t("footerPlayer", { club: b.clubName });
  return {
    subject: t("closed.subject", { what, date: f.date(b.startsAt) }),
    html: layout({ heading, intro, rows, button: { label: t("viewBookings"), url }, footer }),
    text: plainText(heading, intro, rows, url, footer),
  };
}

// ---------------------------------------------------------------------------
// Membership renewal
// ---------------------------------------------------------------------------

export type RenewalEmailData = {
  locale: Locale;
  name: string;
  clubName: string;
  planName: string | null;
  endsAt: string;
  clubEmail: string | null;
  clubPhone: string | null;
};

export function membershipRenewalEmail(m: RenewalEmailData): Rendered {
  const t = translator(m.locale);
  const f = formatters(m.locale);
  const heading = t("greeting", { name: m.name });
  const intro = t("renewal.intro", { club: m.clubName, date: f.day(m.endsAt) });
  const rows: [string, string][] = [];
  if (m.planName) rows.push([t("labels.plan"), m.planName]);
  rows.push([t("labels.ends"), f.day(m.endsAt)]);
  if (m.clubPhone) rows.push([t("labels.phone"), m.clubPhone]);
  if (m.clubEmail) rows.push([t("labels.email"), m.clubEmail]);
  const footer = t("footerPlayer", { club: m.clubName });

  return {
    subject: t("renewal.subject", { club: m.clubName, date: f.day(m.endsAt) }),
    html: layout({
      heading,
      intro,
      rows,
      button: m.clubEmail ? { label: t("renewal.contact"), url: `mailto:${m.clubEmail}` } : undefined,
      footer,
    }),
    text: plainText(heading, intro, rows, undefined, footer),
  };
}

// ---------------------------------------------------------------------------
// Weekly report for the club owner
// ---------------------------------------------------------------------------

export type WeeklyReportData = {
  locale: Locale;
  ownerName: string | null;
  clubName: string;
  weekStart: string; // yyyy-mm-dd, Monday
  bookings: number;
  revenue: number;
  /** 0–100, or null when it can't be worked out (no courts). */
  occupancy: number | null;
  cancellations: number;
  noShows: number;
  newMembers: number;
  expiring: { name: string; endsAt: string }[];
  appUrl: string;
};

export function weeklyReportEmail(r: WeeklyReportData): Rendered {
  const t = translator(r.locale);
  const f = formatters(r.locale);
  const start = new Date(`${r.weekStart}T12:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const week = `${f.day(start)} – ${f.day(end)}`;

  const heading = r.ownerName ? t("greeting", { name: r.ownerName }) : t("greetingNoName");
  const intro = t("report.intro", { club: r.clubName, week });
  const rows: [string, string][] = [
    [t("report.bookings"), String(r.bookings)],
    [t("report.revenue"), f.money(r.revenue)],
    [t("report.occupancy"), r.occupancy === null ? "–" : `${r.occupancy}%`],
    [t("report.cancellations"), String(r.cancellations)],
    [t("report.noShows"), String(r.noShows)],
    [t("report.newMembers"), String(r.newMembers)],
  ];

  const expiringList = r.expiring.length
    ? r.expiring.map((m) => `${m.name} (${f.day(m.endsAt)})`)
    : [t("report.noneExpiring")];
  const extraHtml = `
    <p style="margin:22px 0 6px;font-size:14px;font-weight:600;color:#111c0a">${esc(t("report.expiring"))}</p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#3d4f35">${expiringList.map(esc).join("<br>")}</p>`;

  const url = `${r.appUrl}/${r.locale}/admin/dashboard`;
  const footer = t("footerOwner");

  return {
    subject: t("report.subject", { club: r.clubName, week }),
    html: layout({ heading, intro, rows, extraHtml, button: { label: t("report.openDashboard"), url }, footer, support: true }),
    text: plainText(
      heading,
      intro,
      [...rows, [t("report.expiring"), expiringList.join(", ")]],
      url,
      `${footer}\n${SUPPORT_EMAIL}`,
    ),
  };
}

// ---------------------------------------------------------------------------
// Free trial, to the club owner
// ---------------------------------------------------------------------------

export type TrialEmailData = {
  locale: Locale;
  kind: "ending" | "ended";
  ownerName: string | null;
  clubName: string;
  plan: PlanId;
  trialEndsAt: string;
  appUrl: string;
};

export function trialEmail(d: TrialEmailData): Rendered {
  const t = translator(d.locale);
  const billing = createTranslator({
    locale: d.locale,
    messages: MESSAGES[d.locale] as typeof en,
    namespace: "billing",
  });
  const f = formatters(d.locale);
  const plan = PLANS[d.plan];
  const date = f.day(d.trialEndsAt);

  const heading = d.ownerName ? t("greeting", { name: d.ownerName }) : t("greetingNoName");
  const intro = t(`trial.${d.kind}Intro`, { club: d.clubName, date });
  const rows: [string, string][] = [
    [t("labels.plan"), billing(`planNames.${d.plan}`)],
    [t("labels.price"), t("trial.price", { monthly: plan.priceMonthly, yearly: plan.priceYearly })],
    [t("trial.trialEnds"), date],
  ];
  const url = `${d.appUrl}/${d.locale}/admin/settings`;
  const footer = t("trial.footer");

  return {
    subject: t(`trial.${d.kind}Subject`, { club: d.clubName, date }),
    html: layout({ heading, intro, rows, button: { label: t("trial.seePlan"), url }, footer, support: true }),
    text: plainText(heading, intro, rows, url, `${footer}\n${SUPPORT_EMAIL}`),
  };
}

// ---------------------------------------------------------------------------
// New club signed up, to you (always in English)
// ---------------------------------------------------------------------------

export type NewClubEmailData = {
  clubName: string;
  city: string | null;
  country: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  plan: PlanId;
  trialEndsAt: string | null;
  totalClubs: number;
  clubUrl: string;
};

export function newClubEmail(d: NewClubEmailData): Rendered {
  const f = formatters("en");
  const where = [d.city, d.country].filter(Boolean).join(", ");
  const heading = `New club: ${d.clubName}`;
  const intro = `${d.clubName}${where ? ` (${where})` : ""} just signed up. That makes ${d.totalClubs} ${d.totalClubs === 1 ? "club" : "clubs"} on RaqHub.`;
  const rows: [string, string][] = [
    ["Club", d.clubName],
    ["Where", where || "–"],
    ["Owner", d.ownerName ?? "–"],
    ["Owner email", d.ownerEmail ?? "–"],
    ["Plan", d.plan.charAt(0).toUpperCase() + d.plan.slice(1)],
    ["Trial ends", d.trialEndsAt ? f.day(d.trialEndsAt) : "–"],
  ];
  const footer = "Sent to ADMIN_EMAIL because a club signed up on RaqHub.";

  return {
    subject: `New club on RaqHub: ${d.clubName}${d.city ? ` (${d.city})` : ""}`,
    html: layout({ heading, intro, rows, button: { label: "Open the club page", url: d.clubUrl }, footer }),
    text: plainText(heading, intro, rows, d.clubUrl, footer),
  };
}

// ---------------------------------------------------------------------------
// Staff invite, to the person the club owner invited
// ---------------------------------------------------------------------------

export type StaffInviteEmailData = {
  locale: Locale;
  clubName: string;
  ownerName: string | null;
  email: string;
  appUrl: string;
};

export function staffInviteEmail(d: StaffInviteEmailData): Rendered {
  const t = translator(d.locale);
  const heading = t("staff.heading", { club: d.clubName });
  const intro = d.ownerName
    ? t("staff.intro", { owner: d.ownerName, club: d.clubName })
    : t("staff.introNoName", { club: d.clubName });
  const rows: [string, string][] = [
    [t("staff.club"), d.clubName],
    [t("staff.signInWith"), d.email],
    [t("staff.youCan"), t("staff.screens")],
  ];
  // After signing in they land straight on the club's timetable.
  const url = `${d.appUrl}/${d.locale}/login?redirectTo=${encodeURIComponent(`/${d.locale}/admin/timetable`)}`;
  const footer = t("staff.footer", { club: d.clubName });

  return {
    subject: t("staff.subject", { club: d.clubName }),
    html: layout({ heading, intro, rows, button: { label: t("staff.button"), url }, footer, support: true }),
    text: plainText(heading, intro, rows, url, `${footer}\n${SUPPORT_EMAIL}`),
  };
}

// ---------------------------------------------------------------------------
// Coaching groups, to parents and players (they may have no account)
// ---------------------------------------------------------------------------

export type GroupEmailBase = {
  locale: Locale;
  /** The parent, or the player themselves. */
  contactName: string | null;
  /** The player on the list (often a child). */
  playerName: string;
  groupName: string;
  clubName: string;
  appUrl: string;
};

/** A session was cancelled (rain, a holiday). */
export function groupCancelledEmail(
  d: GroupEmailBase & { startsAt: string; endsAt: string; reason: string | null },
): Rendered {
  const t = translator(d.locale);
  const f = formatters(d.locale);
  const when = `${f.date(d.startsAt)}, ${f.time(d.startsAt)}–${f.time(d.endsAt)}`;
  const heading = d.contactName ? t("greeting", { name: d.contactName }) : t("greetingNoName");
  const intro = t("groups.cancelledIntro", { group: d.groupName, date: f.date(d.startsAt) });
  const rows: [string, string][] = [
    [t("groups.group"), d.groupName],
    [t("groups.player"), d.playerName],
    [t("labels.when"), when],
  ];
  if (d.reason) rows.push([t("groups.reason"), d.reason]);
  const url = `${d.appUrl}/${d.locale}/groups`;
  const footer = t("footerPlayer", { club: d.clubName });
  return {
    subject: t("groups.cancelledSubject", { group: d.groupName, date: f.date(d.startsAt) }),
    html: layout({ heading, intro, rows, button: { label: t("groups.open"), url }, footer }),
    text: plainText(heading, intro, rows, url, footer),
  };
}

/** A place opened up for someone on the waiting list. */
export function groupOfferEmail(
  d: GroupEmailBase & { token: string; expiresAt: string; schedule: string },
): Rendered {
  const t = translator(d.locale);
  const f = formatters(d.locale);
  const until = `${f.date(d.expiresAt)}, ${f.time(d.expiresAt)}`;
  const heading = d.contactName ? t("greeting", { name: d.contactName }) : t("greetingNoName");
  const intro = t("groups.offerIntro", { name: d.playerName, group: d.groupName, club: d.clubName });
  const rows: [string, string][] = [
    [t("groups.group"), d.groupName],
    [t("groups.player"), d.playerName],
    [t("groups.schedule"), d.schedule],
    [t("groups.answerBy"), until],
  ];
  const url = `${d.appUrl}/${d.locale}/groups/offer/${d.token}`;
  const footer = t("groups.offerFooter", { club: d.clubName });
  return {
    subject: t("groups.offerSubject", { group: d.groupName }),
    html: layout({ heading, intro, rows, button: { label: t("groups.offerButton"), url }, footer }),
    text: plainText(heading, intro, rows, url, footer),
  };
}

/** This month's fee hasn't been paid yet. */
export function groupFeeEmail(
  d: GroupEmailBase & { month: string; amount: number; clubPhone: string | null },
): Rendered {
  const t = translator(d.locale);
  const f = formatters(d.locale);
  const month = new Intl.DateTimeFormat(intlLocale(d.locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${d.month}T12:00:00Z`));
  const heading = d.contactName ? t("greeting", { name: d.contactName }) : t("greetingNoName");
  const intro = t("groups.feeIntro", { name: d.playerName, group: d.groupName, month });
  const rows: [string, string][] = [
    [t("groups.group"), d.groupName],
    [t("groups.player"), d.playerName],
    [t("groups.month"), month],
    [t("labels.price"), f.money(d.amount)],
  ];
  if (d.clubPhone) rows.push([t("labels.phone"), d.clubPhone]);
  const footer = t("groups.feeFooter", { club: d.clubName });
  return {
    subject: t("groups.feeSubject", { group: d.groupName, month }),
    html: layout({ heading, intro, rows, footer }),
    text: plainText(heading, intro, rows, undefined, footer),
  };
}
