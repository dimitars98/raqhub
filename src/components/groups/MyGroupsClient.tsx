"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck, ClipboardCheck, UsersRound } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { clubDay, clubFormat, clubTime, feeFor, money, monthName, scheduleText } from "@/lib/groups";
import { leaveGroup, setAbsence, unbookSession } from "@/app/actions/groups";
import type { Group, GroupPlayer, GroupSession } from "@/types/database";

type Names = {
  coachName: string | null;
  courtName: string | null;
  clubName: string;
  clubSlug: string;
  clubPhone: string | null;
};

export type CoachedGroup = Names & {
  group: Group;
  players: number;
  waiting: number;
  next: GroupSession | null;
};

export type MyPlace = Names & {
  player: GroupPlayer;
  offerToken: string | null;
  group: Group;
  sessions: GroupSession[];
  /** Sessions the parent said this player can't come to. */
  excused: string[];
  came: number;
  marked: number;
  paidThisMonth: boolean;
  lastNote: { starts_at: string; note: string | null } | null;
};

export type MyDropin = Names & {
  id: string;
  name: string | null;
  session: Pick<GroupSession, "id" | "starts_at" | "ends_at">;
  group: Group;
};

export default function MyGroupsClient({
  coached,
  places,
  dropins,
  month,
}: {
  coached: CoachedGroup[];
  places: MyPlace[];
  dropins: MyDropin[];
  month: string;
}) {
  const t = useTranslations("myGroups");
  const nothing = coached.length === 0 && places.length === 0 && dropins.length === 0;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
      </div>

      {nothing && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-800">
            <UsersRound size={22} aria-hidden="true" />
          </div>
          <p className="text-base font-semibold text-ink-900">{t("empty")}</p>
          <p className="mt-1 max-w-md text-sm text-ink-600">{t("emptyHint")}</p>
        </div>
      )}

      {coached.length > 0 && (
        <section aria-labelledby="coach" className="flex flex-col gap-3">
          <h2 id="coach" className="text-base font-bold text-ink-900">
            {t("youCoach")}
          </h2>
          {coached.map((c) => (
            <CoachCard key={c.group.id} c={c} />
          ))}
        </section>
      )}

      {places.length > 0 && (
        <section aria-labelledby="places" className="flex flex-col gap-4">
          {coached.length > 0 && (
            <h2 id="places" className="text-base font-bold text-ink-900">
              {t("yourPlaces")}
            </h2>
          )}
          {places.map((p) => (
            <PlaceCard key={p.player.id} p={p} month={month} />
          ))}
        </section>
      )}

      {dropins.length > 0 && (
        <section aria-labelledby="dropins" className="flex flex-col gap-3">
          <h2 id="dropins" className="text-base font-bold text-ink-900">
            {t("dropins")}
          </h2>
          {dropins.map((d) => (
            <DropinRow key={d.id} d={d} />
          ))}
        </section>
      )}
    </div>
  );
}

function CoachCard({ c }: { c: CoachedGroup }) {
  const t = useTranslations("myGroups");
  const locale = useLocale();
  const today = c.next && clubDay(c.next.starts_at) === clubDay(new Date());
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[20px] border border-ink-100 bg-white p-4">
      <Link href={`/groups/${c.group.id}`} className="min-w-0 flex-1">
        <span className="block font-semibold text-ink-900">{c.group.name}</span>
        <span className="block text-[13px] text-ink-600">
          {[scheduleText(c.group, locale), c.courtName, c.clubName].filter(Boolean).join(" · ")}
        </span>
        <span className="mt-1 block text-xs text-ink-600">
          {c.group.kind === "season"
            ? t("players", { n: c.players, max: c.group.max_players })
            : t("dropinGroup")}
          {c.waiting > 0 && ` · ${t("waitingOrAsking", { n: c.waiting })}`}
        </span>
      </Link>
      {c.next && (
        <Link
          href={`/groups/${c.group.id}/register/${c.next.id}`}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold ${
            today ? "bg-ink-900 text-white" : "border border-ink-200 text-ink-900"
          }`}
        >
          <ClipboardCheck size={15} aria-hidden="true" />
          {today
            ? t("registerToday", { time: clubTime(c.next.starts_at) })
            : t("registerNext", {
                date: clubFormat(c.next.starts_at, locale, { weekday: "short", day: "numeric", month: "short" }),
              })}
        </Link>
      )}
    </div>
  );
}

function PlaceCard({ p, month }: { p: MyPlace; month: string }) {
  const t = useTranslations("myGroups");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const g = p.group;
  const status = p.player.status;
  const onList = status === "active" || status === "trial";
  const firstName = p.player.name.split(" ")[0];
  const next = p.sessions.find((s) => s.status === "scheduled");
  const nextToday = next && clubDay(next.starts_at) === clubDay(new Date());
  const priced = g.kind === "season" && Number(g.price) > 0 && g.starts_on <= `${month.slice(0, 8)}31` && g.ends_on >= month;

  const absence = (sessionId: string, absent: boolean) =>
    startTransition(async () => {
      setError(null);
      const r = await setAbsence(sessionId, p.player.id, absent);
      if (r.error) setError(t(`errors.${r.error}`));
      router.refresh();
    });

  return (
    <article className="overflow-hidden rounded-[20px] border border-ink-100 bg-white">
      {onList && next ? (
        <div className="flex flex-col gap-1 bg-ink-900 p-4 text-white">
          <span className="text-xs font-semibold text-brand-200">
            {nextToday
              ? t("nextToday", { time: `${clubTime(next.starts_at)}–${clubTime(next.ends_at)}` })
              : t("next", {
                  date: clubFormat(next.starts_at, locale, { weekday: "long", day: "numeric", month: "long" }),
                  time: clubTime(next.starts_at),
                })}
          </span>
          <h2 className="text-[19px] font-bold">{g.name}</h2>
          <span className="text-xs text-ink-200">
            {[p.player.name, p.courtName, p.coachName && t("with", { coach: p.coachName }), p.clubName]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1 border-b border-ink-100 p-4">
          <h2 className="text-[17px] font-bold text-ink-900">{g.name}</h2>
          <span className="text-xs text-ink-600">
            {[p.player.name, scheduleText(g, locale), p.clubName].join(" · ")}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        {p.player.source === "club" && onList && (
          <p className="text-[13px] text-ink-600">{t("addedByClub", { name: p.player.name })}</p>
        )}

        {status === "trial" && (
          <p className="rounded-xl bg-court-50 px-3.5 py-2.5 text-[13px] text-court-800">{t("trialNote")}</p>
        )}
        {status === "requested" && (
          <p className="rounded-xl bg-court-50 px-3.5 py-2.5 text-[13px] text-court-800">
            {t("requested", { coach: p.coachName ?? t("theCoach") })}
          </p>
        )}
        {status === "waiting" && (
          <p className="rounded-xl bg-ink-50 px-3.5 py-2.5 text-[13px] text-ink-800">
            {t("waiting", {
              date: clubFormat(p.player.waiting_since ?? p.player.created_at, locale, { day: "numeric", month: "long" }),
            })}
          </p>
        )}
        {status === "offered" && p.offerToken && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
            <span className="text-[13px] font-semibold text-brand-900">
              {t("offered", {
                date: p.player.offer_expires_at
                  ? clubFormat(p.player.offer_expires_at, locale, { weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
                  : "",
              })}
            </span>
            <Link href={`/groups/offer/${p.offerToken}`} className="btn-primary px-4 py-2 text-[13px]">
              {t("answer")}
            </Link>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
            {error}
          </p>
        )}

        {onList && (
          <>
            {p.sessions.length > 0 && (
              <ul className="flex flex-col">
                {p.sessions.map((s) => {
                  const away = p.excused.includes(s.id);
                  const started = new Date(s.starts_at) <= new Date();
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 border-b border-ink-50 py-2.5 last:border-0">
                      <span className="text-[13px]">
                        <span className="text-ink-600">
                          {clubFormat(s.starts_at, locale, { weekday: "short", day: "numeric", month: "short" })}
                        </span>{" "}
                        <span className="font-medium text-ink-900">
                          {s.status === "cancelled"
                            ? t("noSession")
                            : `${clubTime(s.starts_at)}–${clubTime(s.ends_at)}`}
                        </span>
                        {s.status === "cancelled" && s.cancel_reason && (
                          <span className="text-ink-600"> · {s.cancel_reason}</span>
                        )}
                        {away && s.status === "scheduled" && (
                          <span className="ml-1.5 rounded-md bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">
                            {t("notComing", { name: firstName })}
                          </span>
                        )}
                      </span>
                      {s.status === "scheduled" && !started && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => absence(s.id, !away)}
                          className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${
                            away ? "border border-ink-200 text-ink-900" : "border border-ink-200 text-ink-900 hover:bg-ink-50"
                          }`}
                        >
                          {away ? t("canComeAfterAll") : t("cantCome", { name: firstName })}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-[14px] bg-ink-50 p-3">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-600">{t("cameTo")}</span>
                <span className="mt-0.5 block text-lg font-bold text-ink-900">
                  {p.marked ? t("cameOf", { n: p.came, of: p.marked }) : "—"}
                </span>
              </div>
              {priced && status === "active" ? (
                <div className={`rounded-[14px] p-3 ${p.paidThisMonth ? "bg-brand-50" : "bg-amber-50"}`}>
                  <span
                    className={`block text-[11px] font-semibold uppercase tracking-[0.06em] ${
                      p.paidThisMonth ? "text-brand-900" : "text-amber-800"
                    }`}
                  >
                    {monthName(month, locale, false)} · {money(feeFor(p.player, g))}
                  </span>
                  <span className={`mt-0.5 block text-lg font-bold ${p.paidThisMonth ? "text-brand-900" : "text-amber-900"}`}>
                    {p.paidThisMonth ? t("paid") : t("notPaid")}
                  </span>
                </div>
              ) : (
                <div className="rounded-[14px] bg-ink-50 p-3">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-600">{t("schedule")}</span>
                  <span className="mt-0.5 block text-sm font-semibold text-ink-900">{scheduleText(g, locale)}</span>
                </div>
              )}
            </div>
            {priced && status === "active" && !p.paidThisMonth && (
              <p className="text-xs text-ink-600">
                {p.clubPhone ? t("payClubPhone", { phone: p.clubPhone }) : t("payClub")}
              </p>
            )}

            {p.lastNote?.note && (
              <div className="flex flex-col gap-1 rounded-[14px] border border-ink-100 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-600">
                  {t("fromCoach", {
                    coach: p.coachName ?? t("theCoach"),
                    date: clubFormat(p.lastNote.starts_at, locale, { weekday: "short", day: "numeric", month: "short" }),
                  })}
                </span>
                <span className="text-[13px] text-ink-800">{p.lastNote.note}</span>
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Link href={`/clubs/${p.clubSlug}#groups`} className="text-[13px] font-medium text-brand-900 underline underline-offset-2">
            {t("moreAt", { club: p.clubName })}
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(status === "waiting" ? t("leaveWaitingConfirm", { name: p.player.name }) : t("leaveConfirm", { name: p.player.name, group: g.name }))) return;
              startTransition(async () => {
                const r = await leaveGroup(p.player.id);
                if (r.error) setError(t(`errors.${r.error}`));
                router.refresh();
              });
            }}
            className="text-[13px] text-ink-600 underline underline-offset-2 hover:text-red-700"
          >
            {status === "waiting" || status === "requested" ? t("leaveWaiting") : t("leave")}
          </button>
        </div>
      </div>
    </article>
  );
}

function DropinRow({ d }: { d: MyDropin }) {
  const t = useTranslations("myGroups");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-ink-100 bg-white p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-800">
        <CalendarCheck size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink-900">{d.group.name}</span>
        <span className="text-[13px] text-ink-600">
          {clubFormat(d.session.starts_at, locale, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
          {clubTime(d.session.starts_at)}–{clubTime(d.session.ends_at)} · {d.clubName}
        </span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          confirm(t("unbookConfirm")) &&
          startTransition(async () => {
            await unbookSession(d.session.id);
            router.refresh();
          })
        }
        className="rounded-full border border-ink-200 px-3.5 py-2 text-[13px] font-medium text-ink-900 hover:bg-ink-50"
      >
        {t("unbook")}
      </button>
    </div>
  );
}
