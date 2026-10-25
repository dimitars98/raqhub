"use client";

import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  Clock,
  CreditCard,
  GraduationCap,
  ShieldCheck,
  Swords,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { dateLocale } from "@/lib/dateLocale";
import { KIND_TONE, TONE_CLASS, type NotificationRow } from "@/lib/notifications";

const ICONS: Record<string, LucideIcon> = {
  booking_new: CalendarPlus,
  lesson_new: GraduationCap,
  booking_cancelled: CalendarX,
  club_cancelled: CalendarX,
  club_booked: CalendarCheck,
  tournament_joined: Trophy,
  tournament_left: Trophy,
  draw: Trophy,
  members_ending: Users,
  staff_joined: UserPlus,
  trial_ending: Clock,
  trial_ended: Clock,
  reminder: Clock,
  membership_ending: CreditCard,
  group_signup: UsersRound,
  group_left: UsersRound,
  group_offer_answer: UsersRound,
  group_absence: CalendarX,
  group_cancelled: CalendarX,
  group_added: UsersRound,
  group_offer: UsersRound,
  group_fee_due: CreditCard,
  match_joined: Swords,
  match_request: Swords,
  match_left: Swords,
  match_full: Swords,
  match_answer: Swords,
  match_removed: Swords,
  match_cancelled: CalendarX,
  match_keep_ask: Clock,
  match_released: CalendarX,
  level_check: ShieldCheck,
  level_confirmed: ShieldCheck,
};

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const bold = (chunks: React.ReactNode) => <strong className="font-semibold text-[#111c0a]">{chunks}</strong>;

/** Turns a notification's kind and data into a title and a detail line. */
export function useDescribe() {
  const t = useTranslations("notifications.kinds");
  const df = dateLocale(useLocale());

  const when = (d: Record<string, unknown>) => {
    const start = d.starts_at ? new Date(str(d.starts_at)) : null;
    const end = d.ends_at ? new Date(str(d.ends_at)) : null;
    if (!start || Number.isNaN(start.getTime())) return "";
    const day = format(start, "EEE d MMM, HH:mm", { locale: df });
    return end && !Number.isNaN(end.getTime()) ? `${day}–${format(end, "HH:mm")}` : day;
  };

  return (n: NotificationRow): { title: React.ReactNode; detail: string } => {
    const d = n.data ?? {};
    const who = str(d.who) || t("someone");
    const court = str(d.court);
    const coach = str(d.coach);
    const what = court || (coach ? t("lessonWith", { coach }) : "");
    switch (n.kind) {
      case "booking_new":
        return {
          title: t.rich("booking_new.title", { who, court: what, b: bold }),
          detail: [when(d), d.price != null ? `€${num(d.price).toFixed(2).replace(/\.00$/, "")}` : ""].filter(Boolean).join(" · "),
        };
      case "lesson_new":
        return {
          title: t.rich("lesson_new.title", { who, coach, b: bold }),
          detail: [when(d), court ? t("lesson_new.court", { court }) : ""].filter(Boolean).join(" · "),
        };
      case "booking_cancelled":
        return {
          title: court
            ? t.rich("booking_cancelled.court", { who, court, b: bold })
            : t.rich("booking_cancelled.lesson", { who, coach, b: bold }),
          detail: [when(d), t("booking_cancelled.free")].filter(Boolean).join(" · "),
        };
      case "tournament_joined":
      case "tournament_left":
        return {
          title: t.rich(`${n.kind}.title`, { name: str(d.name), tournament: str(d.tournament), b: bold }),
          detail: t("places", { count: num(d.count), max: num(d.max) }),
        };
      case "members_ending": {
        const names = Array.isArray(d.names) ? d.names.map(str) : [];
        const count = num(d.count);
        const more = count - names.length;
        return {
          title: t.rich("members_ending.title", { count, b: bold }),
          detail: more > 0 ? t("members_ending.more", { names: names.join(", "), n: more }) : names.join(", "),
        };
      }
      case "staff_joined":
        return { title: t.rich("staff_joined.title", { email: str(d.email), b: bold }), detail: "" };
      case "trial_ending":
        return { title: t.rich("trial_ending.title", { days: num(d.days), b: bold }), detail: t("trial_ending.detail") };
      case "trial_ended":
        return { title: t.rich("trial_ended.title", { b: bold }), detail: t("trial_ended.detail") };
      case "club_booked":
        return {
          title: t.rich("club_booked.title", { club: str(d.club), b: bold }),
          detail: [what, when(d), d.weekly ? t("club_booked.weekly") : ""].filter(Boolean).join(" · "),
        };
      case "club_cancelled":
        return {
          title: t.rich("club_cancelled.title", { club: str(d.club), b: bold }),
          detail: [
            [what, when(d)].filter(Boolean).join(" · "),
            d.club_phone ? t("club_cancelled.phone", { phone: str(d.club_phone) }) : "",
          ]
            .filter(Boolean)
            .join(". "),
        };
      case "reminder":
        return { title: t.rich("reminder.title", { what, b: bold }), detail: when(d) };
      case "draw":
        return {
          title: t.rich("draw.title", { tournament: str(d.tournament), b: bold }),
          detail: d.opponent ? t("draw.opponent", { opponent: str(d.opponent) }) : t("draw.bye"),
        };
      case "membership_ending":
        return {
          title: d.plan
            ? t.rich("membership_ending.plan", { plan: str(d.plan), days: num(d.days), b: bold })
            : t.rich("membership_ending.noPlan", { days: num(d.days), b: bold }),
          detail: t("membership_ending.detail"),
        };
      case "group_signup":
        return {
          title: t.rich(`group_signup.${["active", "trial", "requested", "waiting", "booked"].includes(str(d.status)) ? str(d.status) : "active"}`, {
            name: str(d.name),
            group: str(d.group),
            b: bold,
          }),
          detail: when(d),
        };
      case "group_left":
        return { title: t.rich("group_left.title", { name: str(d.name), group: str(d.group), b: bold }), detail: "" };
      case "group_offer_answer":
        return {
          title: t.rich(d.accepted ? "group_offer_answer.yes" : "group_offer_answer.no", {
            name: str(d.name),
            group: str(d.group),
            b: bold,
          }),
          detail: d.accepted ? "" : t("group_offer_answer.next"),
        };
      case "group_absence":
        return {
          title: t.rich("group_absence.title", { name: str(d.name), group: str(d.group), b: bold }),
          detail: [when(d), str(d.reason)].filter(Boolean).join(" · "),
        };
      case "group_cancelled":
        return {
          title: t.rich("group_cancelled.title", { group: str(d.group), b: bold }),
          detail: [when(d), str(d.reason)].filter(Boolean).join(" · "),
        };
      case "group_added":
        return { title: t.rich("group_added.title", { name: str(d.name), group: str(d.group), b: bold }), detail: "" };
      case "group_offer":
        return {
          title: t.rich("group_offer.title", { name: str(d.name), group: str(d.group), b: bold }),
          detail: d.expires_at
            ? t("group_offer.until", { date: format(new Date(str(d.expires_at)), "EEE d MMM, HH:mm", { locale: df }) })
            : "",
        };
      case "group_fee_due":
        return {
          title: t.rich("group_fee_due.title", {
            group: str(d.group),
            month: d.month ? format(new Date(`${str(d.month)}T12:00:00`), "LLLL", { locale: df }) : "",
            b: bold,
          }),
          detail: [str(d.name), d.amount != null ? `€${num(d.amount).toFixed(2).replace(/\.00$/, "")}` : ""]
            .filter(Boolean)
            .join(" · "),
        };
      case "match_joined":
      case "match_left":
      case "match_full":
        return {
          title: t.rich(`${n.kind}.title`, { who, b: bold }),
          detail: [court || str(d.club), when(d), d.max ? t("players", { count: num(d.count), max: num(d.max) }) : ""]
            .filter(Boolean)
            .join(" · "),
        };
      case "match_request":
        return {
          title: t.rich("match_request.title", { who, level: num(d.level).toFixed(1), b: bold }),
          detail: [when(d), t("match_request.detail")].filter(Boolean).join(" · "),
        };
      case "match_answer":
        return {
          title: t.rich(d.accepted ? "match_answer.yes" : "match_answer.no", { b: bold }),
          detail: [court, str(d.club), when(d)].filter(Boolean).join(" · "),
        };
      case "match_removed":
      case "match_cancelled":
        return {
          title: t.rich(`${n.kind}.title`, { b: bold }),
          detail: [court, str(d.club), when(d)].filter(Boolean).join(" · "),
        };
      case "match_keep_ask":
        return {
          title: t.rich("match_keep_ask.title", { count: num(d.count), max: num(d.max), b: bold }),
          detail: d.release_at
            ? t("match_keep_ask.detail", { time: format(new Date(str(d.release_at)), "EEE d MMM, HH:mm", { locale: df }) })
            : "",
        };
      case "match_released":
        return {
          title: t.rich("match_released.title", { b: bold }),
          detail: [court, when(d)].filter(Boolean).join(" · "),
        };
      case "level_check":
        return {
          title: t.rich("level_check.title", { who, sport: str(d.sport), level: num(d.level).toFixed(1), b: bold }),
          detail: t("level_check.detail"),
        };
      case "level_confirmed":
        return {
          title: t.rich("level_confirmed.title", { club: str(d.club), level: num(d.level).toFixed(1), b: bold }),
          detail: "",
        };
      default:
        return { title: t("unknown"), detail: "" };
    }
  };
}

/** "2 min ago" today, "Yesterday, 16:12", then the date. */
export function useAgo() {
  const t = useTranslations("notifications");
  const df = dateLocale(useLocale());
  return (iso: string) => {
    const date = new Date(iso);
    if (Date.now() - date.getTime() < 60_000) return t("justNow");
    if (isToday(date)) return formatDistanceToNowStrict(date, { addSuffix: true, locale: df });
    if (isYesterday(date)) return t("yesterday", { time: format(date, "HH:mm") });
    return format(date, "d MMM, HH:mm", { locale: df });
  };
}

/** One notification: icon, text, time and the unread dot. */
export default function NotificationItem({
  n,
  onOpen,
  roomy = false,
}: {
  n: NotificationRow;
  onOpen: (n: NotificationRow) => void;
  /** The notifications page: a little more space and the time on the right. */
  roomy?: boolean;
}) {
  const describe = useDescribe();
  const ago = useAgo();
  const t = useTranslations("notifications");
  const { title, detail } = describe(n);
  const Icon = ICONS[n.kind] ?? Clock;
  const unread = !n.read_at;

  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={`flex w-full items-start gap-3 text-left transition-colors ${roomy ? "px-5 py-3.5" : "px-4 py-3"} ${
        unread ? "bg-[#f6fbe9] hover:bg-[#eef8d6]" : "hover:bg-[#f8f9f7]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-9 shrink-0 place-items-center rounded-xl ${TONE_CLASS[KIND_TONE[n.kind] ?? "plain"]}`}
      >
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] leading-snug ${unread ? "text-[#111c0a]" : "text-[#3d4f35]"} ${roomy ? "sm:text-sm" : ""}`}>
          {title}
        </span>
        {detail && <span className="mt-0.5 block text-xs leading-relaxed text-[#55664c]">{detail}</span>}
        {!roomy && <span className="mt-1 block text-[11px] text-[#6e7f65]">{ago(n.created_at)}</span>}
      </span>
      {roomy && <span className="hidden shrink-0 text-xs text-[#6e7f65] sm:block">{ago(n.created_at)}</span>}
      {unread ? (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#7aad12]">
          <span className="sr-only">{t("unreadDot")}</span>
        </span>
      ) : (
        <span className="w-2 shrink-0" />
      )}
    </button>
  );
}

/** Splits a list into Today and Earlier, keeping the order. */
export function splitByDay(items: NotificationRow[]) {
  const today = items.filter((n) => isToday(new Date(n.created_at)));
  const earlier = items.filter((n) => !isToday(new Date(n.created_at)));
  return { today, earlier };
}
