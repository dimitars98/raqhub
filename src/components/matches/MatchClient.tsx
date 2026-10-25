"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, Link2, ShieldCheck, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  answerRequest,
  cancelMatch,
  joinMatch,
  keepCourt,
  leaveMatch,
  postMessage,
  removePlayer,
} from "@/app/actions/openMatches";
import { useCopy } from "@/hooks/useCopy";
import { useLabels } from "@/hooks/useLabels";
import { clubFormat, clubTime } from "@/lib/groups";
import { fitsLevel, isFull, levelText, rangeText, type MatchDetail, type MatchPlayer } from "@/lib/openMatches";
import { EmptyDot, LevelTag, PlayerDot, money, useWhen } from "./bits";

export default function MatchClient({
  match: m,
  myLevel,
  justOpened,
}: {
  match: MatchDetail;
  myLevel: number | null;
  justOpened: boolean;
}) {
  const t = useTranslations("matches");
  const locale = useLocale();
  const labels = useLabels();
  const when = useWhen();
  const router = useRouter();
  const { copied, copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const started = new Date(m.starts_at) <= new Date();
  const active = m.status === "open" && !started;
  const full = isFull(m);
  const fits = fitsLevel(m, myLevel);
  const perTeam = m.max_players / 2;
  const team = (n: 1 | 2) => m.players.filter((p) => p.team === n);
  const canLeave = new Date(m.leave_until) > new Date();
  const href = `/matches/${m.id}`;

  const longDate = (iso: string) =>
    clubFormat(iso, locale, { weekday: "long", day: "numeric", month: "long" }) + ", " + clubTime(iso);

  /** Runs an action, shows its error or refreshes the page. */
  const run = (fn: () => Promise<{ error?: string; message?: string }>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (r.error) {
        setError(
          r.error === "booking"
            ? r.message ?? t("errors.failed")
            : r.error === "cancelDeadline"
              ? t("errors.cancelDeadline", { hours: Number(r.message) || 0 })
              : t(`errors.${r.error}`),
        );
        return;
      }
      after?.();
      router.refresh();
    });

  const join = (teamNo: 1 | 2 | null) => {
    if (myLevel == null) {
      router.push(`/matches/level?sport=${m.sport}&next=${encodeURIComponent(href)}`);
      return;
    }
    run(() => joinMatch(m.id, teamNo));
  };

  const share = async () => {
    const url = window.location.href.split("?")[0];
    const text = t("shareText", { when: when(m.starts_at, m.ends_at), club: m.club.name });
    if (navigator.share) {
      try {
        await navigator.share({ title: t("title"), text, url });
        return;
      } catch {
        // Closed the share sheet: nothing to do.
        return;
      }
    }
    copy("link", url);
  };

  const status = !active
    ? m.status === "cancelled"
      ? t("statusCancelled")
      : m.status === "released"
        ? t("statusReleased")
        : t("statusStarted")
    : full
      ? t("statusFull")
      : t("statusOpen", { n: m.max_players - m.taken });

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4 pb-32 lg:pb-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/matches" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900">
          <ChevronLeft size={16} aria-hidden="true" />
          {t("back")}
        </Link>
        {active && (
          <button type="button" onClick={share} className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[13px]">
            <Link2 size={15} aria-hidden="true" />
            {copied === "link" ? t("copied") : t("share")}
          </button>
        )}
      </div>

      {justOpened && active && (
        <p className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">{t("justOpened")}</p>
      )}

      {/* When and where */}
      <section aria-labelledby="when" className="flex flex-col gap-1.5 rounded-[20px] bg-ink-900 p-5 text-white">
        <span className="text-xs font-semibold text-brand-200">
          {[
            labels.sport(m.sport),
            m.competitive ? t("competitive") : t("friendly"),
            t("levelRange", { range: rangeText(m.level_min, m.level_max) }),
          ].join(" · ")}
        </span>
        <h1 id="when" className="text-2xl font-extrabold tracking-tight">
          {when(m.starts_at, m.ends_at)}
        </h1>
        <span className="text-[13px] text-ink-200">
          {[m.club.name, m.court, m.indoor == null ? null : labels.inOut(m.indoor)].filter(Boolean).join(" · ")}
        </span>
        <span
          className={`mt-1.5 w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
            active ? "bg-brand-400 text-ink-900" : "bg-white/15 text-white"
          }`}
        >
          {status}
        </span>
      </section>

      {/* The organiser: keep the court or let it go back */}
      {m.organiser && active && !full && (
        <section className="flex flex-col gap-3 rounded-[20px] border border-accent-400/40 bg-accent-100/60 p-4">
          <p className="text-[13px] leading-relaxed text-ink-900">
            {m.keep_court
              ? t("keepingCourt")
              : t("releaseNote", { time: longDate(m.release_at) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => keepCourt(m.id, !m.keep_court))}
              className="btn-secondary px-4 py-2 text-[13px]"
            >
              {m.keep_court ? t("dontKeep") : t("keepCourt")}
            </button>
          </div>
        </section>
      )}

      {/* Players */}
      <section aria-labelledby="players" className="flex flex-col gap-3 rounded-[20px] border border-ink-100 bg-white p-4">
        <h2 id="players" className="text-[15px] font-bold text-ink-900">
          {t("players")} <span className="font-medium text-ink-600">· {m.taken}/{m.max_players}</span>
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {([1, 2] as const).map((n) => {
            const list = team(n);
            const free = Math.max(0, perTeam - list.length);
            return (
              <div key={n} className="flex flex-col gap-2.5 rounded-[14px] bg-ink-50 p-3">
                <span className="text-[11px] font-semibold tracking-wider text-ink-600 uppercase">
                  {m.max_players === 4 ? t(n === 1 ? "teamA" : "teamB") : t(n === 1 ? "side1" : "side2")}
                </span>
                {list.map((p, i) => (
                  <PlayerRow
                    key={p.id ?? `${p.name}-${i}`}
                    p={p}
                    canRemove={m.organiser && active && !p.organiser && !!p.id}
                    onRemove={() => p.id && run(() => removePlayer(m.id, p.id!))}
                    pending={pending}
                  />
                ))}
                {Array.from({ length: free }, (_, i) =>
                  !m.mine && active && !full ? (
                    <button
                      key={i}
                      type="button"
                      disabled={pending}
                      onClick={() => join(n)}
                      className="flex items-center gap-2 text-left text-[13px] font-semibold text-brand-900 hover:underline"
                    >
                      <EmptyDot size="size-8" />
                      {fits || myLevel == null ? t("takePlace") : t("askPlace")}
                    </button>
                  ) : (
                    <span key={i} className="flex items-center gap-2 text-[13px] text-ink-600">
                      <EmptyDot size="size-8" />
                      {t("freePlace")}
                    </span>
                  ),
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Asked to join: only the organiser sees these */}
      {m.organiser && m.requests.length > 0 && (
        <section aria-labelledby="requests" className="flex flex-col gap-3 rounded-[20px] border border-ink-100 bg-white p-4">
          <h2 id="requests" className="text-[15px] font-bold text-ink-900">
            {t("requests")}
          </h2>
          <p className="-mt-1 text-xs text-ink-600">{t("requestsHint")}</p>
          {m.requests.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm">
                <PlayerDot player={p} size="size-8" />
                <span className="font-semibold text-ink-900">{p.name}</span>
                <span className="text-ink-600">
                  · <LevelTag level={p.level} checked={p.checked} />
                </span>
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={pending || full}
                  onClick={() => p.id && run(() => answerRequest(m.id, p.id!, true))}
                  className="btn-primary px-3.5 py-2 text-xs"
                >
                  {t("letIn")}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => p.id && run(() => answerRequest(m.id, p.id!, false))}
                  className="btn-secondary px-3.5 py-2 text-xs"
                >
                  {t("turnDown")}
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      {/* Details */}
      <section aria-labelledby="details" className="flex flex-col gap-2.5 rounded-[20px] border border-ink-100 bg-white p-4 text-[13px]">
        <h2 id="details" className="text-[15px] font-bold text-ink-900">
          {t("details")}
        </h2>
        <Row label={t("price")}>
          {Number(m.price_each) > 0
            ? t("priceValue", { each: money(m.price_each), court: money(Number(m.price_each) * m.max_players) })
            : "–"}
        </Row>
        <Row label={t("payment")}>{t("paymentValue")}</Row>
        <Row label={t("type")}>{m.competitive ? t("competitiveLong") : t("friendlyLong")}</Row>
        {m.mine === "in" && !m.organiser && active && (
          <Row label={t("leaveUntil")}>{longDate(m.leave_until)}</Row>
        )}
        {m.club_address && <Row label={t("address")}>{m.club_address}</Row>}
        {m.club_phone && (
          <Row label={t("clubPhone")}>
            <a href={`tel:${m.club_phone}`} className="underline">
              {m.club_phone}
            </a>
          </Row>
        )}
        {m.note && <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-ink-600">{m.note}</p>}
        {m.mine === "in" && !m.organiser && active && (
          <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-xs leading-relaxed text-ink-600">
            {t("leaveRule", { time: longDate(m.leave_until) })}
          </p>
        )}
      </section>

      {/* Messages: only for the players */}
      {m.messages && <Messages match={m} />}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* The main action, at the bottom of the screen */}
      {active && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white px-4 pt-3 pb-5 lg:static lg:border-0 lg:bg-transparent lg:p-0">
          <div className="mx-auto flex max-w-[640px] flex-col gap-1.5">
            {m.organiser ? (
              confirmCancel ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmCancel(false)} className="btn-secondary flex-1 justify-center">
                    {t("keepIt")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => cancelMatch(m.id), () => setConfirmCancel(false))}
                    className="btn-primary flex-1 justify-center bg-red-700 hover:bg-red-800"
                  >
                    {t("yesCancel")}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmCancel(true)} className="btn-secondary h-12 justify-center">
                  {t("cancelCourt")}
                </button>
              )
            ) : m.mine === "in" ? (
              canLeave ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => leaveMatch(m.id))}
                  className="btn-secondary h-12 justify-center"
                >
                  {t("leave")}
                </button>
              ) : (
                <p className="text-center text-sm text-ink-600">{t("tooLateToLeave")}</p>
              )
            ) : m.mine === "requested" ? (
              <>
                <p className="text-center text-sm text-ink-600">{t("waitingForOrganiser")}</p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => leaveMatch(m.id))}
                  className="btn-secondary h-11 justify-center"
                >
                  {t("withdraw")}
                </button>
              </>
            ) : full ? (
              <p className="text-center text-sm text-ink-600">{t("matchFull")}</p>
            ) : (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => join(null)}
                  className="btn-primary h-12 justify-center text-[15px] font-bold"
                >
                  {pending
                    ? t("joining")
                    : myLevel == null
                      ? t("setLevelToJoin")
                      : fits
                        ? Number(m.price_each) > 0
                          ? t("joinPrice", { price: money(m.price_each) })
                          : t("join")
                        : t("askToJoin")}
                </button>
                <span className="text-center text-[11px] text-ink-600">
                  {myLevel != null && !fits
                    ? t("outsideRange", { level: levelText(myLevel) })
                    : t("joinNote")}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-600">{label}</span>
      <span className="text-right text-ink-900">{children}</span>
    </div>
  );
}

function PlayerRow({
  p,
  canRemove,
  onRemove,
  pending,
}: {
  p: MatchPlayer;
  canRemove: boolean;
  onRemove: () => void;
  pending: boolean;
}) {
  const t = useTranslations("matches");
  return (
    <div className="flex items-center gap-2">
      <PlayerDot player={p} size="size-8" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold text-ink-900">{p.me ? t("youName", { name: p.name }) : p.name}</span>
        <span className="flex items-center gap-1 text-[11px] text-ink-600">
          <LevelTag level={p.level} checked={p.checked} />
          {p.organiser && <span>· {t("organiser")}</span>}
        </span>
      </span>
      {canRemove && (
        <button
          type="button"
          disabled={pending}
          onClick={onRemove}
          aria-label={t("removeName", { name: p.name })}
          title={t("remove")}
          className="grid size-8 place-items-center rounded-lg text-ink-400 hover:bg-white hover:text-red-700"
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function Messages({ match: m }: { match: MatchDetail }) {
  const t = useTranslations("matches");
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const messages = m.messages ?? [];

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      setError(null);
      const r = await postMessage(m.id, text);
      if (r.error) {
        setError(t(`errors.${r.error}`));
        return;
      }
      setText("");
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="chat" className="flex flex-col gap-3 rounded-[20px] border border-ink-100 bg-white p-4">
      <h2 id="chat" className="text-[15px] font-bold text-ink-900">
        {t("messages")} <span className="font-medium text-ink-600">· {t("playersOnly")}</span>
      </h2>
      {messages.length === 0 ? (
        <p className="text-[13px] text-ink-600">{t("noMessages")}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {messages.map((msg, i) => (
            <li key={i} className="flex flex-col gap-0.5 text-[13px]">
              <span className="text-[11px] font-semibold text-ink-600">
                {msg.me ? t("you") : msg.name} · {clubTime(msg.at)}
              </span>
              <span className="whitespace-pre-line text-ink-900">{msg.body}</span>
            </li>
          ))}
        </ul>
      )}
      {m.mine === "in" && (
        <form onSubmit={send} className="flex gap-2">
          <label htmlFor="match-message" className="sr-only">
            {t("message")}
          </label>
          <input
            id="match-message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder={t("messagePlaceholder")}
            className="input"
          />
          <button type="submit" disabled={pending || !text.trim()} className="btn-primary shrink-0">
            {t("send")}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      <ShieldNote />
    </section>
  );
}

function ShieldNote() {
  const t = useTranslations("matches");
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-ink-600">
      <ShieldCheck size={12} aria-hidden="true" />
      {t("chatPrivacy")}
    </p>
  );
}
