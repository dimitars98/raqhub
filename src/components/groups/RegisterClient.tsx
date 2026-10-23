"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { CancelModal, type DetailSession } from "@/components/groups/GroupClient";
import { clubDay, clubFormat, clubTime } from "@/lib/groups";
import { saveRegister, type RegisterRow } from "@/app/actions/groups";
import type { AttendanceStatus, GroupAttendance, GroupPlayer } from "@/types/database";
import { useReadOnly } from "@/components/admin/ReadOnly";

type Mark = "present" | "absent" | null;

export type RegisterGroup = {
  id: string;
  name: string;
  kind: "season" | "dropin";
  max_players: number;
  courtName: string | null;
};

/** The coach's register for one session, made for a phone at the side of the court. */
export default function RegisterClient({
  backHref,
  group,
  session,
  players,
  attendance,
  unpaid,
  number,
  total,
}: {
  backHref: string;
  group: RegisterGroup;
  session: DetailSession;
  players: Pick<GroupPlayer, "id" | "name" | "status" | "trial_session_id">[];
  attendance: Pick<GroupAttendance, "id" | "player_id" | "guest_name" | "status" | "paid" | "reason">[];
  unpaid: string[];
  number: number;
  total: number;
}) {
  const t = useTranslations("groups.register");
  const { readOnly, hint } = useReadOnly();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const markOf = (s: AttendanceStatus | undefined): Mark =>
    s === "present" ? "present" : s === "absent" || s === "excused" ? "absent" : null;

  const rowFor = (playerId: string) => attendance.find((a) => a.player_id === playerId);
  const [marks, setMarks] = useState<Record<string, Mark>>(() => {
    const m: Record<string, Mark> = {};
    for (const p of players) m[p.id] = markOf(rowFor(p.id)?.status);
    for (const a of attendance) if (!a.player_id) m[a.id] = markOf(a.status);
    return m;
  });
  const [paid, setPaid] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(attendance.filter((a) => !a.player_id).map((a) => [a.id, a.paid])),
  );
  const [removed, setRemoved] = useState<string[]>([]);
  const [guests, setGuests] = useState<{ key: string; name: string; mark: Mark; paid: boolean }[]>([]);
  const [guestName, setGuestName] = useState("");
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState(session.note ?? "");

  const others = attendance.filter((a) => !a.player_id && !removed.includes(a.id));
  const everyone = [
    ...players.map((p) => marks[p.id]),
    ...others.map((a) => marks[a.id]),
    ...guests.map((g) => g.mark),
  ];
  const here = everyone.filter((m) => m === "present").length;
  const away = everyone.filter((m) => m === "absent").length;
  const toMark = everyone.length - here - away;

  const cancelled = session.status === "cancelled";
  const isToday = clubDay(session.starts_at) === clubDay(new Date());

  const allHere = () => {
    setSaved(false);
    setMarks((m) => {
      const next = { ...m };
      for (const p of players) if (next[p.id] === null) next[p.id] = "present";
      for (const a of others) if (next[a.id] === null) next[a.id] = "present";
      return next;
    });
    setGuests((g) => g.map((x) => ({ ...x, mark: x.mark ?? "present" })));
  };

  const save = () => {
    setError(null);
    const rows: RegisterRow[] = [
      ...players.map((p) => {
        const before = rowFor(p.id);
        const mark = marks[p.id];
        // Keep the parent's "can't come" unless the coach says they came.
        const status: AttendanceStatus | null =
          mark === "absent" && before?.status === "excused"
            ? "excused"
            : mark ?? (before?.status === "booked" ? "booked" : before?.status === "excused" ? "excused" : null);
        return { player_id: p.id, status };
      }),
      ...others.map((a) => ({
        attendance_id: a.id,
        status: (marks[a.id] ?? "booked") as AttendanceStatus,
        paid: paid[a.id] ?? false,
      })),
      ...removed.map((id) => ({ attendance_id: id, remove: true })),
      ...guests.map((g) => ({ guest_name: g.name, status: (g.mark ?? "present") as AttendanceStatus, paid: g.paid })),
    ];
    if (readOnly) return setError(hint ?? null);
    startTransition(async () => {
      const r = await saveRegister(session.id, rows, note);
      if (r.error) {
        setError(t(`errors.${r.error}`));
        return;
      }
      setSaved(true);
      setGuests([]);
      setRemoved([]);
      router.refresh();
    });
  };

  const set = (key: string, mark: Mark) => {
    setSaved(false);
    setMarks((m) => ({ ...m, [key]: m[key] === mark ? null : mark }));
  };

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-3.5 pb-28">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          aria-label={t("back")}
          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-ink-100 bg-white text-ink-900"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
        <h1 className="text-[15px] font-semibold text-ink-900">{t("title")}</h1>
      </div>

      <div className="flex flex-col gap-1.5 rounded-[18px] bg-ink-900 p-4 text-white">
        <span className="text-xs font-semibold text-brand-200">
          {isToday ? t("today") : clubFormat(session.starts_at, locale, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
          {clubTime(session.starts_at)}–{clubTime(session.ends_at)}
          {group.courtName || session.courtName ? ` · ${session.courtName ?? group.courtName}` : ""}
        </span>
        <span className="text-[19px] font-bold">{group.name}</span>
        {total > 0 && <span className="text-xs text-ink-200">{t("sessionOf", { n: number, total })}</span>}
      </div>

      {cancelled && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("cancelledNote", { reason: session.cancel_reason ?? "" })}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-600" aria-live="polite">
          <span className="font-semibold text-ink-900">{t("here", { n: here })}</span> · {t("away", { n: away })}
          {toMark > 0 && ` · ${t("toMark", { n: toMark })}`}
        </span>
        <button type="button" onClick={allHere} className="rounded-full border border-ink-200 bg-white px-3 py-2 text-[13px] font-medium text-ink-900">
          {t("allHere")}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col rounded-[18px] border border-ink-100 bg-white">
        {players.length === 0 && others.length === 0 && guests.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-600">
            {group.kind === "dropin" ? t("noBookings") : t("noPlayers")}
          </p>
        )}
        {players.map((p) => {
          const before = rowFor(p.id);
          return (
            <PersonRow
              key={p.id}
              name={p.name}
              sub={
                before?.status === "excused"
                  ? before.reason
                    ? t("parentSaid", { reason: before.reason })
                    : t("parentSaidNo")
                  : p.status === "trial"
                    ? t("trial")
                    : unpaid.includes(p.id)
                      ? t("unpaid")
                      : null
              }
              subTone={before?.status === "excused" ? "muted" : unpaid.includes(p.id) && p.status !== "trial" ? "warn" : "info"}
              mark={marks[p.id]}
              onMark={(m) => set(p.id, m)}
            />
          );
        })}
        {others.map((a) => (
          <PersonRow
            key={a.id}
            name={a.guest_name ?? ""}
            sub={group.kind === "dropin" ? null : t("guest")}
            subTone="info"
            mark={marks[a.id]}
            onMark={(m) => set(a.id, m)}
            paid={group.kind === "dropin" ? paid[a.id] : undefined}
            onPaid={(v) => {
              setSaved(false);
              setPaid((x) => ({ ...x, [a.id]: v }));
            }}
            onRemove={() => {
              setSaved(false);
              setRemoved((r) => [...r, a.id]);
            }}
          />
        ))}
        {guests.map((g) => (
          <PersonRow
            key={g.key}
            name={g.name}
            sub={t("guestNew")}
            subTone="info"
            mark={g.mark}
            onMark={(m) => setGuests((list) => list.map((x) => (x.key === g.key ? { ...x, mark: x.mark === m ? null : m } : x)))}
            paid={group.kind === "dropin" ? g.paid : undefined}
            onPaid={(v) => setGuests((list) => list.map((x) => (x.key === g.key ? { ...x, paid: v } : x)))}
            onRemove={() => setGuests((list) => list.filter((x) => x.key !== g.key))}
          />
        ))}
      </div>

      {adding ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!guestName.trim()) return;
            setGuests((list) => [...list, { key: `${Date.now()}`, name: guestName.trim(), mark: "present", paid: false }]);
            setGuestName("");
            setAdding(false);
            setSaved(false);
          }}
        >
          <input
            className="input flex-1"
            autoFocus
            maxLength={80}
            placeholder={t("guestName")}
            aria-label={t("guestName")}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
          />
          <button type="submit" className="btn-primary px-4">
            {t("add")}
          </button>
          <button type="button" aria-label={t("close")} onClick={() => setAdding(false)} className="btn-ghost px-3">
            <X size={16} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-dashed border-ink-200 bg-white px-3 py-3 text-[13px] font-medium text-brand-900"
        >
          <Plus size={15} aria-hidden="true" />
          {group.kind === "dropin" ? t("addDropin") : t("addGuest")}
        </button>
      )}

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-900">
        {t("note")}
        <textarea
          rows={2}
          maxLength={1000}
          className="input resize-none"
          placeholder={t("notePlaceholder")}
          value={note}
          onChange={(e) => {
            setSaved(false);
            setNote(e.target.value);
          }}
        />
        <span className="text-xs font-normal text-ink-600">{t("noteHint")}</span>
      </label>

      {!cancelled && new Date(session.ends_at) > new Date() && (
        <button title={hint} disabled={readOnly} type="button" onClick={() => setCancelling(true)} className="self-center p-2 text-[13px] text-red-700 underline underline-offset-2">
          {isToday ? t("cancelToday") : t("cancelThis")}
        </button>
      )}

      <div className="fixed inset-x-3 bottom-4 z-20 mx-auto max-w-[536px]">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-ink-900 text-[15px] font-semibold text-white shadow-[0_20px_40px_-16px_rgba(17,28,10,0.6)] disabled:opacity-60"
        >
          {saved ? <Check size={17} aria-hidden="true" /> : null}
          {pending ? t("saving") : saved ? t("saved") : t("save")}
        </button>
      </div>

      {cancelling && (
        <CancelModal
          session={session}
          people={players.length + others.length}
          onClose={() => setCancelling(false)}
          onDone={() => router.push(backHref)}
        />
      )}
    </div>
  );
}

function PersonRow({
  name,
  sub,
  subTone,
  mark,
  onMark,
  paid,
  onPaid,
  onRemove,
}: {
  name: string;
  sub: string | null;
  subTone: "warn" | "info" | "muted";
  mark: Mark;
  onMark: (m: Mark) => void;
  paid?: boolean;
  onPaid?: (v: boolean) => void;
  onRemove?: () => void;
}) {
  const t = useTranslations("groups.register");
  return (
    <div className={`flex items-center gap-2.5 border-b border-ink-50 py-2.5 pl-3.5 pr-3 last:border-0 ${mark === null ? "" : ""}`}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-900">{name}</span>
        {sub && (
          <span
            className={`block truncate text-[11px] ${
              subTone === "warn" ? "font-semibold text-amber-800" : subTone === "muted" ? "text-ink-600" : "text-court-600"
            }`}
          >
            {sub}
          </span>
        )}
        {onPaid && (
          <label className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-600">
            <input type="checkbox" className="size-4 accent-brand-600" checked={!!paid} onChange={(e) => onPaid(e.target.checked)} />
            {t("paid")}
          </label>
        )}
      </span>
      <span role="radiogroup" aria-label={name} className="flex shrink-0 gap-1">
        <button
          type="button"
          role="radio"
          aria-checked={mark === "present"}
          onClick={() => onMark("present")}
          className={`h-10 w-[58px] rounded-[10px] text-xs transition-colors ${
            mark === "present" ? "bg-brand-600 font-semibold text-ink-900" : "border border-ink-100 bg-white text-ink-600"
          }`}
        >
          {t("hereButton")}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mark === "absent"}
          onClick={() => onMark("absent")}
          className={`h-10 w-[58px] rounded-[10px] text-xs transition-colors ${
            mark === "absent" ? "bg-ink-600 font-semibold text-white" : "border border-ink-100 bg-white text-ink-600"
          }`}
        >
          {t("awayButton")}
        </button>
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={t("removeName", { name })}
          onClick={onRemove}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-800"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
