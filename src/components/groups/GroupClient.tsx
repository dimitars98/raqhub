"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ArrowRightLeft,
  Check,
  ClipboardCheck,
  Link2,
  Mail,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import Modal from "@/components/ui/Modal";
import PlayerModal from "@/components/groups/PlayerModal";
import { WhoFor } from "@/components/groups/GroupsClient";
import { useLabels } from "@/hooks/useLabels";
import {
  ON_LIST,
  clubDay,
  clubFormat,
  clubTime,
  feeFor,
  money,
  monthName,
  noon,
  placesTaken,
  scheduleText,
  seasonMonths,
} from "@/lib/groups";
import {
  archiveGroup,
  deleteGroup,
  moveSession,
  offerPlace,
  remindUnpaid,
  setPlayerStatus,
} from "@/app/[locale]/admin/groups/actions";
import { cancelSession, markFee, restoreSession, unmarkFee } from "@/app/actions/groups";
import type { FeeMethod, Group, GroupAttendance, GroupFee, GroupPlayer, GroupSession } from "@/types/database";

export type DetailGroup = Group & { coachName: string | null; courtName: string | null };
export type DetailSession = GroupSession & { courtName: string | null };
export type DetailAttendance = Pick<GroupAttendance, "id" | "session_id" | "player_id" | "status" | "guest_name" | "paid">;

type Tab = "players" | "sessions" | "fees" | "waiting";
const MAILTO_LIMIT = 1900;

export default function GroupClient({
  mode,
  group,
  players,
  sessions,
  attendance,
  fees,
  courts,
  month,
  signupUrl,
  notice: initialNotice,
}: {
  mode: "admin" | "coach";
  group: DetailGroup;
  players: GroupPlayer[];
  sessions: DetailSession[];
  attendance: DetailAttendance[];
  fees: GroupFee[];
  courts: { id: string; name: string }[];
  month: string;
  signupUrl: string | null;
  notice?: string | null;
}) {
  const t = useTranslations("groups");
  const td = useTranslations("groups.detail");
  const labels = useLabels();
  const locale = useLocale();
  const router = useRouter();
  const admin = mode === "admin";
  const base = admin ? `/admin/groups/${group.id}` : `/groups/${group.id}`;
  const season = group.kind === "season";

  const [tab, setTab] = useState<Tab>(season ? "players" : "sessions");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    initialNotice ? { ok: true, text: initialNotice } : null,
  );
  const [pending, startTransition] = useTransition();
  const [playerModal, setPlayerModal] = useState<GroupPlayer | "new" | null>(null);
  const [cancelling, setCancelling] = useState<DetailSession | null>(null);
  const [moving, setMoving] = useState<DetailSession | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  type Done = { error?: string; sent?: number; offered?: number };
  const run = (task: () => Promise<Done | void>, ok?: string | ((r: Done) => string)) =>
    startTransition(async () => {
      const result: Done = (await task()) ?? {};
      if (result.error) setNotice({ ok: false, text: td(`errors.${result.error}`) });
      else if (ok) setNotice({ ok: true, text: typeof ok === "function" ? ok(result) : ok });
      router.refresh();
    });

  const onList = players.filter((p) => ON_LIST.includes(p.status));
  const requests = players.filter((p) => p.status === "requested");
  const queue = players
    .filter((p) => p.status === "waiting" || p.status === "offered")
    .sort((a, b) => (a.waiting_since ?? a.created_at).localeCompare(b.waiting_since ?? b.created_at));
  const taken = placesTaken(players);
  const full = taken >= group.max_players;

  const now = new Date();
  const today = clubDay(now);
  const upcoming = sessions.filter((s) => new Date(s.ends_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = sessions.filter((s) => new Date(s.ends_at) <= now).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const nextSessions = upcoming.filter((s) => s.status === "scheduled").slice(0, 4);
  const held = past.filter((s) => s.status === "scheduled");

  const feeByPlayer = useMemo(() => {
    const map = new Map<string, GroupFee>();
    for (const f of fees) map.set(`${f.player_id}:${f.month}`, f);
    return map;
  }, [fees]);

  // Attendance: present out of the sessions so far where they were marked.
  const pastIds = new Set(sessions.filter((s) => new Date(s.starts_at) <= new Date()).map((s) => s.id));
  const attendanceOf = (playerId: string) => {
    const rows = attendance.filter(
      (a) => a.player_id === playerId && a.status !== "booked" && pastIds.has(a.session_id),
    );
    return { here: rows.filter((a) => a.status === "present").length, of: rows.length };
  };

  const months = seasonMonths(group.starts_on, group.ends_on).filter((m) => m <= month || m === nextMonth(month));
  const inSeason = months.includes(month);
  const [feeMonth, setFeeMonth] = useState(inSeason ? month : (months[months.length - 1] ?? month));
  const priced = Number(group.price) > 0;

  const unpaidThisMonth = onList.filter((p) => p.status === "active" && !feeByPlayer.has(`${p.id}:${month}`));
  const paidThisMonth = onList.filter((p) => p.status === "active" && feeByPlayer.has(`${p.id}:${month}`));
  const expected = onList.filter((p) => p.status === "active").reduce((n, p) => n + feeFor(p, group), 0);
  const collected = paidThisMonth.reduce((n, p) => n + Number(feeByPlayer.get(`${p.id}:${month}`)?.amount ?? 0), 0);

  const emailParents = async () => {
    const emails = [...new Set(onList.flatMap((p) => (p.email ? [p.email] : [])))];
    if (!emails.length) {
      setNotice({ ok: false, text: td("noEmails") });
      return;
    }
    const link = `mailto:?bcc=${emails.map(encodeURIComponent).join(",")}&subject=${encodeURIComponent(group.name)}`;
    if (link.length <= MAILTO_LIMIT) {
      window.location.assign(link);
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setNotice({ ok: true, text: td("emailsCopied", { n: emails.length }) });
    } catch {
      setNotice({ ok: false, text: td("errors.failed") });
    }
  };

  const tabs: { key: Tab; label: string; count?: number; accent?: boolean }[] = season
    ? [
        { key: "players", label: td("tabs.players"), count: onList.length },
        { key: "sessions", label: td("tabs.sessions"), count: sessions.filter((s) => s.status === "scheduled").length },
        ...(priced ? [{ key: "fees" as Tab, label: td("tabs.fees") }] : []),
        { key: "waiting", label: td("tabs.waiting"), count: queue.length + requests.length, accent: queue.length + requests.length > 0 },
      ]
    : [{ key: "sessions", label: td("tabs.sessions"), count: upcoming.filter((s) => s.status === "scheduled").length }];

  return (
    <div className="mx-auto max-w-[1180px]">
      {/* Title */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Link href={admin ? "/admin/groups" : "/groups"} className="text-[13px] text-ink-600 hover:text-ink-900">
            ← {admin ? t("title") : td("myGroups")}
          </Link>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-court-50 px-2 py-0.5 text-[11px] font-semibold text-court-800">
              {labels.sport(group.sport)}
            </span>
            <span className="rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
              {season ? <WhoFor g={group} /> : t("kind.dropin")}
            </span>
            {season && full && (
              <span className="rounded-md bg-ink-900 px-2 py-0.5 text-[11px] font-semibold text-white">{t("full")}</span>
            )}
            {group.archived_at && (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                {td("archived")}
              </span>
            )}
          </div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-ink-900">{group.name}</h1>
          <p className="text-sm text-ink-600">
            {[
              scheduleText(group, locale),
              group.courtName,
              group.coachName,
              season ? t("perMonth", { price: money(Number(group.price)) }) : t("perSession", { price: money(Number(group.price)) }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {season && (
            <button type="button" onClick={emailParents} className="btn-secondary inline-flex items-center gap-2">
              <Mail size={15} aria-hidden="true" />
              {td("emailParents")}
            </button>
          )}
          {admin && (
            <>
              <Link href={`${base}/edit`} className="btn-secondary inline-flex items-center gap-2">
                <Pencil size={15} aria-hidden="true" />
                {td("edit")}
              </Link>
              {season && !group.archived_at && (
                <button type="button" onClick={() => setPlayerModal("new")} className="btn-primary">
                  <UserPlus size={15} aria-hidden="true" />
                  {td("addPlayer")}
                </button>
              )}
              <span className="relative">
                <button
                  type="button"
                  aria-label={td("more")}
                  aria-expanded={menu === "group"}
                  onClick={() => setMenu(menu === "group" ? null : "group")}
                  className="grid size-[42px] place-items-center rounded-full border border-ink-200 bg-white text-ink-800 hover:bg-ink-50"
                >
                  <MoreHorizontal size={18} aria-hidden="true" />
                </button>
                {menu === "group" && (
                  <Menu onClose={() => setMenu(null)}>
                    <MenuItem
                      icon={<Archive size={15} />}
                      onClick={() => {
                        setMenu(null);
                        if (!group.archived_at && !confirm(td("archiveConfirm"))) return;
                        run(() => archiveGroup(group.id, !group.archived_at), group.archived_at ? td("unarchived") : td("archivedDone"));
                      }}
                    >
                      {group.archived_at ? td("unarchive") : td("archive")}
                    </MenuItem>
                    <MenuItem
                      danger
                      icon={<Trash2 size={15} />}
                      onClick={() => {
                        setMenu(null);
                        if (!confirm(td("deleteConfirm"))) return;
                        startTransition(async () => {
                          const r = await deleteGroup(group.id);
                          if (r.error) setNotice({ ok: false, text: td("errors.failed") });
                          else router.push("/admin/groups");
                        });
                      }}
                    >
                      {td("delete")}
                    </MenuItem>
                  </Menu>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.ok ? "border-brand-200 bg-brand-50 text-brand-900" : "border-red-100 bg-red-50 text-red-700"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" aria-label={td("dismiss")} onClick={() => setNotice(null)}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" aria-label={group.name} className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-100">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
              tab === x.key ? "border-ink-900 font-semibold text-ink-900" : "border-transparent text-ink-600 hover:text-ink-900"
            }`}
          >
            {x.label}{" "}
            {x.count !== undefined && (
              <span className={x.accent ? "font-semibold text-court-600" : "text-ink-400"}>{x.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          {/* ---------------- Players ---------------- */}
          {tab === "players" && (
            <>
              {requests.length > 0 && (
                <section className="rounded-[20px] border border-court-100 bg-court-50/50 p-4">
                  <h2 className="mb-3 text-sm font-semibold text-ink-900">{td("requests", { n: requests.length })}</h2>
                  <div className="flex flex-col gap-2">
                    {requests.map((p) => (
                      <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-[14px] bg-white px-3.5 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink-900">
                            {p.name}
                            {p.age ? `, ${p.age}` : ""}
                          </span>
                          <span className="text-xs text-ink-600">
                            {[p.contact_name, p.email, p.phone].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {admin && (
                          <>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => run(() => setPlayerStatus(group.id, p.id, full ? "waiting" : "active"), full ? td("toWaiting", { name: p.name }) : td("accepted", { name: p.name }))}
                              className="btn-primary px-4 py-2 text-[13px]"
                            >
                              {full ? td("acceptToWaiting") : td("accept")}
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => run(() => setPlayerStatus(group.id, p.id, "left"), td("declined", { name: p.name }))}
                              className="btn-secondary px-4 py-2 text-[13px]"
                            >
                              {td("decline")}
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {priced && inSeason && onList.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white px-[18px] py-3.5">
                  <div className="flex flex-wrap items-center gap-3.5">
                    <span className="text-sm font-semibold text-ink-900">{td("feesFor", { month: monthName(month, locale) })}</span>
                    <span className="text-[13px] text-ink-600">
                      {td("paidOf", {
                        n: paidThisMonth.length,
                        of: paidThisMonth.length + unpaidThisMonth.length,
                        amount: money(collected),
                        total: money(expected),
                      })}
                    </span>
                    <span aria-hidden="true" className="block h-1.5 w-32 overflow-hidden rounded-full bg-ink-100">
                      <span
                        className="block h-full bg-brand-600"
                        style={{ width: `${expected ? Math.round((collected / expected) * 100) : 0}%` }}
                      />
                    </span>
                  </div>
                  {admin && unpaidThisMonth.some((p) => p.email) && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => remindUnpaid(group.id, month),
                          (r: Done) => td("reminded", { n: r.sent ?? 0 }),
                        )
                      }
                      className="rounded-full border border-amber-200 bg-amber-50 px-3.5 py-2 text-[13px] font-medium text-amber-900"
                    >
                      {td("remindUnpaid", { n: unpaidThisMonth.length })}
                    </button>
                  )}
                </div>
              )}

              {onList.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
                  <p className="font-semibold text-ink-900">{td("noPlayers")}</p>
                  <p className="mt-1 text-sm text-ink-600">{group.online_signup ? td("noPlayersOnline") : td("noPlayersHint")}</p>
                  {admin && (
                    <button type="button" onClick={() => setPlayerModal("new")} className="btn-primary mt-5">
                      <UserPlus size={15} aria-hidden="true" />
                      {td("addPlayer")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-[20px] border border-ink-100 bg-white">
                  <table className="w-full min-w-[640px] border-collapse text-[13px]">
                    <thead>
                      <tr className="text-left text-xs text-ink-600">
                        <th scope="col" className="border-b border-ink-100 px-5 py-3.5 font-semibold">{td("col.player")}</th>
                        <th scope="col" className="border-b border-ink-100 px-3 py-3.5 font-semibold">{td("col.contact")}</th>
                        <th scope="col" className="border-b border-ink-100 px-3 py-3.5 font-semibold">{td("col.attendance")}</th>
                        {priced && inSeason && (
                          <th scope="col" className="border-b border-ink-100 px-3 py-3.5 font-semibold">
                            {monthName(month, locale, false)}
                          </th>
                        )}
                        <th scope="col" className="border-b border-ink-100 py-3.5 pl-3 pr-5">
                          <span className="sr-only">{td("col.actions")}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {onList.map((p) => {
                        const a = attendanceOf(p.id);
                        const fee = feeByPlayer.get(`${p.id}:${month}`);
                        const trialSession = p.trial_session_id ? sessions.find((s) => s.id === p.trial_session_id) : null;
                        return (
                          <tr key={p.id} className={!fee && priced && inSeason && p.status === "active" ? "bg-[#fffdf5]" : ""}>
                            <td className="border-b border-ink-50 px-5 py-3 align-top">
                              <span className="block font-semibold text-ink-900">{p.name}</span>
                              <span className="text-xs text-ink-600">
                                {[p.age, td("since", { date: clubFormat(noon(p.joined_on), locale, { month: "short", year: "numeric" }) })]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                              {p.status === "trial" && (
                                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-md bg-court-50 px-2 py-0.5 text-[11px] font-semibold text-court-800">
                                    {trialSession
                                      ? td("trialOn", { date: clubFormat(trialSession.starts_at, locale, { weekday: "short", day: "numeric", month: "short" }) })
                                      : td("trial")}
                                  </span>
                                  {admin && (
                                    <button
                                      type="button"
                                      onClick={() => run(() => setPlayerStatus(group.id, p.id, "active"), td("kept", { name: p.name }))}
                                      className="text-[11px] font-semibold text-brand-900 underline underline-offset-2"
                                    >
                                      {td("keep")}
                                    </button>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="border-b border-ink-50 px-3 py-3 align-top">
                              <span className="block text-ink-900">{p.contact_name ?? (p.profile_id ? td("ownAccount") : "—")}</span>
                              <span className="text-xs text-ink-600">{[p.email, p.phone].filter(Boolean).join(" · ") || "—"}</span>
                            </td>
                            <td className="border-b border-ink-50 px-3 py-3 align-top text-ink-900">
                              {a.of ? td("attended", { n: a.here, of: a.of }) : <span className="text-ink-400">—</span>}
                            </td>
                            {priced && inSeason && (
                              <td className="border-b border-ink-50 px-3 py-3 align-top">
                                {p.status === "trial" ? (
                                  <span className="text-xs text-ink-400">—</span>
                                ) : (
                                  <FeeCell
                                    fee={fee}
                                    amount={feeFor(p, group)}
                                    busy={pending}
                                    onPay={(method) => run(() => markFee(p.id, month, feeFor(p, group), method))}
                                    onUndo={() => run(() => unmarkFee(p.id, month))}
                                  />
                                )}
                              </td>
                            )}
                            <td className="border-b border-ink-50 py-3 pl-3 pr-5 text-right align-top">
                              {admin && (
                                <span className="relative inline-block">
                                  <button
                                    type="button"
                                    aria-label={td("moreFor", { name: p.name })}
                                    aria-expanded={menu === p.id}
                                    onClick={() => setMenu(menu === p.id ? null : p.id)}
                                    className="grid size-8 place-items-center rounded-lg text-ink-600 hover:bg-ink-50"
                                  >
                                    <MoreHorizontal size={17} aria-hidden="true" />
                                  </button>
                                  {menu === p.id && (
                                    <Menu onClose={() => setMenu(null)} right>
                                      <MenuItem icon={<Pencil size={15} />} onClick={() => { setMenu(null); setPlayerModal(p); }}>
                                        {td("editPlayer")}
                                      </MenuItem>
                                      <MenuItem
                                        icon={<ArrowRightLeft size={15} />}
                                        onClick={() => { setMenu(null); run(() => setPlayerStatus(group.id, p.id, "waiting"), td("toWaiting", { name: p.name })); }}
                                      >
                                        {td("moveToWaiting")}
                                      </MenuItem>
                                      <MenuItem
                                        danger
                                        icon={<X size={15} />}
                                        onClick={() => {
                                          setMenu(null);
                                          if (!confirm(td("removeConfirm", { name: p.name }))) return;
                                          run(() => setPlayerStatus(group.id, p.id, "left"), (r: Done) => r.offered ? td("removedOffered", { name: p.name }) : td("removed", { name: p.name }));
                                        }}
                                      >
                                        {td("remove")}
                                      </MenuItem>
                                    </Menu>
                                  )}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ---------------- Sessions ---------------- */}
          {tab === "sessions" && (
            <Sessions
              upcoming={upcoming}
              past={past}
              attendance={attendance}
              base={base}
              admin={admin}
              dropin={!season}
              maxPlayers={group.max_players}
              busy={pending}
              onCancel={setCancelling}
              onMove={setMoving}
              onRestore={(s) => run(() => restoreSession(s.id), td("restored"))}
            />
          )}

          {/* ---------------- Fees ---------------- */}
          {tab === "fees" && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-ink-900">
                  {td("month")}
                  <select className="input w-auto" value={feeMonth} onChange={(e) => setFeeMonth(e.target.value)}>
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {monthName(m, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                {admin && feeMonth === month && unpaidThisMonth.some((p) => p.email) && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => remindUnpaid(group.id, month), (r: Done) => td("reminded", { n: r.sent ?? 0 }))}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3.5 py-2 text-[13px] font-medium text-amber-900"
                  >
                    {td("remindUnpaid", { n: unpaidThisMonth.length })}
                  </button>
                )}
              </div>
              <FeesTable
                players={players.filter(
                  (p) =>
                    (p.status === "active" || (p.status === "left" && feeByPlayer.has(`${p.id}:${feeMonth}`))) &&
                    p.joined_on <= `${feeMonth.slice(0, 8)}31`,
                )}
                group={group}
                month={feeMonth}
                feeByPlayer={feeByPlayer}
                busy={pending}
                onPay={(p, method) => run(() => markFee(p.id, feeMonth, feeFor(p, group), method))}
                onUndo={(p) => run(() => unmarkFee(p.id, feeMonth))}
              />
              <p className="text-xs text-ink-600">{td("feesHint")}</p>
            </section>
          )}

          {/* ---------------- Waiting list ---------------- */}
          {tab === "waiting" && (
            <section className="flex flex-col gap-3 rounded-[20px] border border-ink-100 bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-base font-bold text-ink-900">
                  {td("waitingTitle")} <span className="font-semibold text-ink-400">{queue.length}</span>
                </h2>
                <span className="text-xs text-ink-600">{td("waitingHint")}</span>
              </div>
              {queue.length === 0 && requests.length === 0 && (
                <p className="py-6 text-center text-sm text-ink-600">{td("waitingEmpty")}</p>
              )}
              {queue.map((p, i) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-[14px] bg-ink-50/70 px-3.5 py-3">
                  <span
                    className={`grid size-[26px] shrink-0 place-items-center rounded-full text-xs font-bold ${
                      i === 0 ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-900"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-900">
                      {p.name}
                      {p.age ? `, ${p.age}` : ""}
                    </span>
                    <span className="text-xs text-ink-600">
                      {p.status === "offered" && p.offer_expires_at
                        ? td("offeredUntil", {
                            date: clubFormat(p.offer_expires_at, locale, { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
                          })
                        : [
                            td("waitingSince", { date: clubFormat(p.waiting_since ?? p.created_at, locale, { day: "numeric", month: "short" }) }),
                            p.source === "online" ? td("joinedOnline") : td("addedByClub"),
                          ].join(" · ")}
                    </span>
                  </span>
                  {admin && p.status === "waiting" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => offerPlace(group.id, p.id),
                          (r: Done) => (r.sent ? td("offerSent", { name: p.name }) : td("offerMade", { name: p.name })),
                        )
                      }
                      className={i === 0 ? "btn-primary px-4 py-2 text-[13px]" : "btn-secondary px-4 py-2 text-[13px]"}
                    >
                      {td("offerPlace")}
                    </button>
                  )}
                  {admin && (
                    <button
                      type="button"
                      aria-label={td("removeFromWaiting", { name: p.name })}
                      disabled={pending}
                      onClick={() => confirm(td("removeConfirm", { name: p.name })) && run(() => setPlayerStatus(group.id, p.id, "left"))}
                      className="grid size-8 place-items-center rounded-lg text-ink-600 hover:bg-white"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              {requests.length > 0 && (
                <p className="text-xs text-ink-600">
                  {td("requestsOnPlayers", { n: requests.length })}{" "}
                  <button type="button" onClick={() => setTab("players")} className="font-semibold text-brand-900 underline underline-offset-2">
                    {td("tabs.players")}
                  </button>
                </p>
              )}
            </section>
          )}
        </div>

        {/* ---------------- Side ---------------- */}
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <section aria-labelledby="next" className="flex flex-col gap-2.5 rounded-[20px] border border-ink-100 bg-white p-[18px]">
            <h2 id="next" className="mb-1 text-base font-bold text-ink-900">{td("nextSessions")}</h2>
            {nextSessions.length === 0 && <p className="text-sm text-ink-600">{td("noUpcoming")}</p>}
            {nextSessions.map((s, i) => {
              const isToday = clubDay(s.starts_at) === today;
              const away = attendance.filter((a) => a.session_id === s.id && a.status === "excused").length;
              const booked = attendance.filter((a) => a.session_id === s.id && a.status !== "excused").length;
              const coming = season ? onList.length - away : booked;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-[14px] p-3 ${isToday || i === 0 ? "border border-brand-200 bg-brand-50" : ""}`}
                >
                  <span className="w-11 shrink-0 text-center">
                    <span className="block text-[11px] font-semibold uppercase text-ink-600">
                      {clubFormat(s.starts_at, locale, { weekday: "short" })}
                    </span>
                    <span className="block text-xl font-bold text-ink-900">{clubFormat(s.starts_at, locale, { day: "numeric" })}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-900">
                      {isToday ? td("todayAt", { time: clubTime(s.starts_at) }) : `${clubTime(s.starts_at)}–${clubTime(s.ends_at)}`}
                    </span>
                    <span className="text-xs text-ink-600">
                      {season ? td("coming", { n: coming }) : td("bookedOf", { n: booked, max: group.max_players })}
                      {s.moved && s.courtName ? ` · ${s.courtName}` : ""}
                      {away > 0 && season ? ` · ${td("cantCome", { n: away })}` : ""}
                    </span>
                  </span>
                  {(isToday || i === 0) && (
                    <Link href={`${base}/register/${s.id}`} className="rounded-full bg-ink-900 px-3 py-2 text-[13px] font-semibold text-white">
                      {td("register")}
                    </Link>
                  )}
                </div>
              );
            })}
          </section>

          <section aria-labelledby="setup" className="flex flex-col gap-3 rounded-[20px] border border-ink-100 bg-white p-[18px] text-[13px]">
            <h2 id="setup" className="text-base font-bold text-ink-900">{td("setup")}</h2>
            <Fact label={td("season")}>
              {clubFormat(noon(group.starts_on), locale, { day: "numeric", month: "short", year: "numeric" })} –{" "}
              {clubFormat(noon(group.ends_on), locale, { day: "numeric", month: "short", year: "numeric" })}
            </Fact>
            <Fact label={td("sessionsLabel")}>
              {td("sessionsDone", { n: sessions.filter((s) => s.status === "scheduled").length, done: held.length })}
            </Fact>
            {group.breaks.length > 0 && (
              <Fact label={td("noSessionsOn")}>
                {group.breaks.map((b) => b.label || clubFormat(noon(b.from), locale, { day: "numeric", month: "short" })).join(", ")}
              </Fact>
            )}
            <Fact label={td("places")}>{season ? t("placesOf", { n: taken, max: group.max_players }) : td("perSessionMax", { n: group.max_players })}</Fact>
            <Fact label={td("onlineSignup")}>
              <span className={group.online_signup ? "font-semibold text-brand-900" : "text-ink-600"}>
                {group.online_signup ? (season && group.coach_approves ? td("onApproval") : td("on")) : td("off")}
              </span>
            </Fact>
            {season && (
              <Fact label={td("trialSession")}>
                <span className={group.trial ? "font-semibold text-brand-900" : "text-ink-600"}>{group.trial ? td("on") : td("off")}</span>
              </Fact>
            )}
            {group.member_price != null && (
              <Fact label={td("memberPrice")}>{t("perMonth", { price: money(Number(group.member_price)) })}</Fact>
            )}
            {admin && signupUrl && group.online_signup && (
              <CopyLink url={signupUrl} label={td("copyLink")} done={td("copied")} />
            )}
          </section>
        </aside>
      </div>

      {playerModal && (
        <PlayerModal
          groupId={group.id}
          player={playerModal === "new" ? undefined : playerModal}
          full={playerModal === "new" && full}
          defaultPrice={Number(group.price)}
          onClose={() => setPlayerModal(null)}
          onSaved={(text) => {
            setNotice({ ok: true, text });
            router.refresh();
          }}
        />
      )}
      {cancelling && (
        <CancelModal
          session={cancelling}
          people={season ? onList.length : attendance.filter((a) => a.session_id === cancelling.id && a.status !== "excused").length}
          onClose={() => setCancelling(null)}
          onDone={(text) => {
            setNotice({ ok: true, text });
            router.refresh();
          }}
        />
      )}
      {moving && (
        <MoveModal
          groupId={group.id}
          session={moving}
          courts={courts}
          onClose={() => setMoving(null)}
          onDone={(text) => {
            setNotice({ ok: true, text });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-600">{label}</span>
      <span className="text-right font-medium text-ink-900">{children}</span>
    </div>
  );
}

function CopyLink({ url, label, done }: { url: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt(label, url);
        }
      }}
      className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2.5 font-medium text-ink-900 hover:bg-ink-50"
    >
      {copied ? <Check size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
      {copied ? done : label}
    </button>
  );
}

function Menu({ children, onClose, right }: { children: React.ReactNode; onClose: () => void; right?: boolean }) {
  return (
    <>
      <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-20 cursor-default" onClick={onClose} />
      <div
        className={`absolute top-11 z-30 flex w-56 flex-col rounded-[14px] border border-ink-100 bg-white p-1.5 text-left shadow-[0_20px_40px_-20px_rgba(17,28,10,0.45)] ${
          right ? "right-0" : "right-0 sm:left-auto"
        }`}
      >
        {children}
      </div>
    </>
  );
}

function MenuItem({
  children,
  icon,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13px] hover:bg-ink-50 ${
        danger ? "text-red-700" : "text-ink-900"
      }`}
    >
      <span aria-hidden="true" className={danger ? "text-red-600" : "text-ink-600"}>
        {icon}
      </span>
      {children}
    </button>
  );
}

function FeeCell({
  fee,
  amount,
  busy,
  onPay,
  onUndo,
}: {
  fee: GroupFee | undefined;
  amount: number;
  busy: boolean;
  onPay: (method: FeeMethod) => void;
  onUndo: () => void;
}) {
  const td = useTranslations("groups.detail");
  const [open, setOpen] = useState(false);
  if (fee) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-900">
          {td("paidBy", { method: td(`method.${fee.method}`) })}
        </span>
        <button
          type="button"
          aria-label={td("undoPaid")}
          title={td("undoPaid")}
          disabled={busy}
          onClick={onUndo}
          className="grid size-6 place-items-center rounded-md text-ink-400 hover:bg-ink-50 hover:text-ink-800"
        >
          <RotateCcw size={12} aria-hidden="true" />
        </button>
      </span>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900"
      >
        {td("unpaidMark", { amount: money(amount) })}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {(["cash", "bank"] as const).map((m) => (
        <button
          key={m}
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            onPay(m);
          }}
          className="rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          {td(`method.${m}`)}
        </button>
      ))}
      <button
        type="button"
        aria-label={td("dismiss")}
        onClick={() => setOpen(false)}
        className="grid size-7 place-items-center rounded-lg text-ink-600 hover:bg-ink-50"
      >
        <X size={13} aria-hidden="true" />
      </button>
    </span>
  );
}

function FeesTable({
  players,
  group,
  month,
  feeByPlayer,
  busy,
  onPay,
  onUndo,
}: {
  players: GroupPlayer[];
  group: DetailGroup;
  month: string;
  feeByPlayer: Map<string, GroupFee>;
  busy: boolean;
  onPay: (p: GroupPlayer, method: FeeMethod) => void;
  onUndo: (p: GroupPlayer) => void;
}) {
  const td = useTranslations("groups.detail");
  const locale = useLocale();
  const paid = players.filter((p) => feeByPlayer.has(`${p.id}:${month}`));
  const total = players.reduce((n, p) => n + feeFor(p, group), 0);
  const got = paid.reduce((n, p) => n + Number(feeByPlayer.get(`${p.id}:${month}`)?.amount ?? 0), 0);
  if (players.length === 0) {
    return <p className="rounded-[20px] bg-white px-5 py-10 text-center text-sm text-ink-600">{td("noFees")}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-[20px] border border-ink-100 bg-white">
      <p className="border-b border-ink-100 px-5 py-3.5 text-sm text-ink-800">
        {td("paidOf", { n: paid.length, of: players.length, amount: money(got), total: money(total) })}
      </p>
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-xs text-ink-600">
            <th scope="col" className="border-b border-ink-100 px-5 py-3 font-semibold">{td("col.player")}</th>
            <th scope="col" className="border-b border-ink-100 px-3 py-3 font-semibold">{td("col.amount")}</th>
            <th scope="col" className="border-b border-ink-100 px-3 py-3 font-semibold">{td("col.status")}</th>
            <th scope="col" className="border-b border-ink-100 py-3 pl-3 pr-5 font-semibold">{td("col.paidOn")}</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const fee = feeByPlayer.get(`${p.id}:${month}`);
            return (
              <tr key={p.id}>
                <td className="border-b border-ink-50 px-5 py-3 font-semibold text-ink-900">
                  {p.name}
                  {p.status === "left" && <span className="ml-1.5 text-xs font-normal text-ink-600">{td("leftGroup")}</span>}
                </td>
                <td className="border-b border-ink-50 px-3 py-3 text-ink-900">{money(fee ? Number(fee.amount) : feeFor(p, group))}</td>
                <td className="border-b border-ink-50 px-3 py-3">
                  <FeeCell fee={fee} amount={feeFor(p, group)} busy={busy} onPay={(m) => onPay(p, m)} onUndo={() => onUndo(p)} />
                </td>
                <td className="border-b border-ink-50 py-3 pl-3 pr-5 text-ink-600">
                  {fee ? clubFormat(fee.paid_at, locale, { day: "numeric", month: "short" }) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Sessions({
  upcoming,
  past,
  attendance,
  base,
  admin,
  dropin,
  maxPlayers,
  busy,
  onCancel,
  onMove,
  onRestore,
}: {
  upcoming: DetailSession[];
  past: DetailSession[];
  attendance: DetailAttendance[];
  base: string;
  admin: boolean;
  dropin: boolean;
  maxPlayers: number;
  busy: boolean;
  onCancel: (s: DetailSession) => void;
  onMove: (s: DetailSession) => void;
  onRestore: (s: DetailSession) => void;
}) {
  const td = useTranslations("groups.detail");
  const locale = useLocale();
  const [which, setWhich] = useState<"upcoming" | "past">("upcoming");
  const [shown, setShown] = useState(12);
  // Sessions cancelled only because the schedule changed are noise here.
  const list = (which === "upcoming" ? upcoming : past).filter((s) => !s.schedule_cancelled);

  return (
    <section className="flex flex-col gap-3">
      <div role="tablist" aria-label={td("tabs.sessions")} className="flex gap-2">
        {(["upcoming", "past"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={which === k}
            onClick={() => {
              setWhich(k);
              setShown(12);
            }}
            className={`rounded-full border px-3.5 py-2 text-[13px] ${
              which === k ? "border-ink-900 bg-ink-900 font-semibold text-white" : "border-ink-100 bg-white text-ink-600"
            }`}
          >
            {td(k)}
          </button>
        ))}
      </div>
      {list.length === 0 && (
        <p className="rounded-[20px] bg-white px-5 py-10 text-center text-sm text-ink-600">
          {which === "upcoming" ? td("noUpcoming") : td("noPast")}
        </p>
      )}
      <div className="flex flex-col overflow-hidden rounded-[20px] border border-ink-100 bg-white">
        {list.slice(0, shown).map((s) => {
          const rows = attendance.filter((a) => a.session_id === s.id);
          const here = rows.filter((a) => a.status === "present").length;
          const away = rows.filter((a) => a.status === "absent" || a.status === "excused").length;
          const booked = rows.filter((a) => a.status !== "excused").length;
          const cancelled = s.status === "cancelled";
          const isPast = new Date(s.ends_at) <= new Date();
          return (
            <div key={s.id} className={`flex flex-wrap items-center gap-3 border-b border-ink-50 px-4 py-3 last:border-0 ${cancelled ? "bg-ink-50/60" : ""}`}>
              <span className={`w-12 shrink-0 text-center ${cancelled ? "text-ink-400" : "text-ink-900"}`}>
                <span className="block text-[11px] font-semibold uppercase text-ink-600">
                  {clubFormat(s.starts_at, locale, { weekday: "short" })}
                </span>
                <span className={`block text-lg font-bold leading-tight ${cancelled ? "line-through" : ""}`}>
                  {clubFormat(s.starts_at, locale, { day: "numeric" })}
                </span>
                <span className="block text-[11px] text-ink-600">{clubFormat(s.starts_at, locale, { month: "short" })}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-900">
                  {cancelled ? td("cancelled") : `${clubTime(s.starts_at)}–${clubTime(s.ends_at)}`}
                  {!cancelled && s.moved && (
                    <span className="ml-2 rounded-md bg-court-50 px-1.5 py-0.5 text-[11px] font-semibold text-court-800">
                      {td("moved")}
                    </span>
                  )}
                </span>
                <span className="text-xs text-ink-600">
                  {cancelled
                    ? s.cancel_reason ?? td("noReason")
                    : [
                        s.courtName,
                        dropin
                          ? td("bookedOf", { n: booked, max: maxPlayers })
                          : s.register_taken_at
                            ? td("registerSummary", { here, away })
                            : isPast
                              ? td("noRegister")
                              : null,
                        s.note ? `“${s.note}”` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {!cancelled && (
                  <Link href={`${base}/register/${s.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-[13px] font-medium text-ink-900 hover:bg-ink-50">
                    <ClipboardCheck size={14} aria-hidden="true" />
                    {s.register_taken_at ? td("viewRegister") : td("register")}
                  </Link>
                )}
                {!cancelled && !isPast && admin && (
                  <button type="button" onClick={() => onMove(s)} className="rounded-full px-3 py-1.5 text-[13px] text-ink-600 hover:bg-ink-50">
                    {td("move")}
                  </button>
                )}
                {!cancelled && !isPast && (
                  <button type="button" onClick={() => onCancel(s)} className="rounded-full px-3 py-1.5 text-[13px] text-red-700 hover:bg-red-50">
                    {td("cancel")}
                  </button>
                )}
                {cancelled && !isPast && (
                  <button type="button" disabled={busy} onClick={() => onRestore(s)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-ink-800 hover:bg-ink-50">
                    <RotateCcw size={13} aria-hidden="true" />
                    {td("restore")}
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {list.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + 20)} className="btn-secondary self-center">
          {td("showMore", { n: list.length - shown })}
        </button>
      )}
    </section>
  );
}

export function CancelModal({
  session,
  people,
  onClose,
  onDone,
}: {
  session: DetailSession;
  people: number;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const td = useTranslations("groups.detail");
  const locale = useLocale();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose}>
      <Modal.Content>
        <Modal.Header>
          {td("cancelTitle", {
            date: clubFormat(session.starts_at, locale, { weekday: "long", day: "numeric", month: "long" }),
          })}
        </Modal.Header>
        <Modal.Body>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <p className="text-sm text-ink-600">{td("cancelBody", { n: people })}</p>
          <Modal.Field label={td("reason")} htmlFor="gs-reason">
            <input id="gs-reason"
              className="input"
              value={reason}
              maxLength={200}
              placeholder={td("reasonPlaceholder")}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </Modal.Field>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            {td("keepSession")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await cancelSession(session.id, reason);
                if (r.error) {
                  setError(td(`errors.${r.error}`));
                  return;
                }
                onDone(r.sent ? td("cancelledSent", { n: r.sent }) : td("cancelledDone"));
                onClose();
              })
            }
            className="flex-1 rounded-full bg-red-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? td("working") : td("cancelSession")}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}

function MoveModal({
  groupId,
  session,
  courts,
  onClose,
  onDone,
}: {
  groupId: string;
  session: DetailSession;
  courts: { id: string; name: string }[];
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const td = useTranslations("groups.detail");
  const [day, setDay] = useState(clubDay(session.starts_at));
  const [start, setStart] = useState(clubTime(session.starts_at));
  const [end, setEnd] = useState(clubTime(session.ends_at));
  const [court, setCourt] = useState(session.court_id ?? courts[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose}>
      <Modal.Content>
        <Modal.Header>{td("moveTitle")}</Modal.Header>
        <Modal.Body>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <Modal.Field label={td("date")} htmlFor="gs-date">
            <input id="gs-date" type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} />
          </Modal.Field>
          <Modal.Grid>
            <Modal.Field label={td("from")} htmlFor="gs-from">
              <input id="gs-from" type="time" step={300} className="input" value={start} onChange={(e) => setStart(e.target.value)} />
            </Modal.Field>
            <Modal.Field label={td("to")} htmlFor="gs-to">
              <input id="gs-to" type="time" step={300} className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Modal.Field>
          </Modal.Grid>
          <Modal.Field label={td("court")} htmlFor="gs-court">
            <select id="gs-court" className="input" value={court} onChange={(e) => setCourt(e.target.value)}>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Modal.Field>
          <p className="text-xs text-ink-600">{td("moveHint")}</p>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            {td("close")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await moveSession(groupId, session.id, day, start, end, court);
                if (r.error) {
                  setError(td(`errors.${r.error}`));
                  return;
                }
                onDone(td("movedDone"));
                onClose();
              })
            }
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {pending ? td("working") : td("moveSave")}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}

