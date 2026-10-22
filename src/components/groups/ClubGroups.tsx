"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Clock } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import Modal from "@/components/ui/Modal";
import { useLabels } from "@/hooks/useLabels";
import { WhoFor } from "@/components/groups/GroupsClient";
import { clubFormat, clubTime, money, scheduleText } from "@/lib/groups";
import { bookSession, joinGroup, unbookSession } from "@/app/actions/groups";
import type { GroupLevel, Sport } from "@/types/database";

export type PublicGroup = {
  id: string;
  name: string;
  kind: "season" | "dropin";
  sport: Sport;
  level: GroupLevel;
  age_min: number | null;
  age_max: number | null;
  adults: boolean;
  days: number[];
  start_time: string;
  end_time: string;
  price: number;
  max_players: number;
  trial: boolean;
  coach_approves: boolean;
  description: string | null;
  coach_name: string | null;
  court_name: string | null;
  taken: number;
  waiting: number;
  sessions: { id: string; starts_at: string; ends_at: string; taken: number; mine: boolean }[];
};

type Viewer = "visitor" | "player" | "admin";

/** Groups and clinics on the club's public page, with sign-up. */
export default function ClubGroups({
  groups,
  viewer,
  myName,
  loginHref,
}: {
  groups: PublicGroup[];
  viewer: Viewer;
  myName: string | null;
  loginHref: string;
}) {
  const t = useTranslations("groupSignup");
  const [joining, setJoining] = useState<{ group: PublicGroup; trial: boolean } | null>(null);
  const [done, setDone] = useState<{ status: string; name: string; group: string } | null>(null);

  return (
    <section id="groups" className="mb-12 scroll-mt-24">
      <h2 className="mb-1 text-xl font-bold tracking-tight text-ink-900">{t("title")}</h2>
      <p className="mb-5 text-sm text-ink-600">{t("subtitle")}</p>
      {done && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <Check size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {t(`done.${done.status}`, { name: done.name, group: done.group })}{" "}
            <Link href="/groups" className="font-semibold underline underline-offset-2">
              {t("seeMyGroups")}
            </Link>
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) =>
          g.kind === "dropin" ? (
            <DropinCard key={g.id} g={g} viewer={viewer} loginHref={loginHref} />
          ) : (
            <SeasonCard
              key={g.id}
              g={g}
              viewer={viewer}
              loginHref={loginHref}
              onJoin={(trial) => setJoining({ group: g, trial })}
            />
          ),
        )}
      </div>
      {joining && (
        <JoinModal
          group={joining.group}
          trial={joining.trial}
          myName={myName}
          onClose={() => setJoining(null)}
          onDone={(status, name) => setDone({ status, name, group: joining.group.name })}
        />
      )}
    </section>
  );
}

function Header({ g }: { g: PublicGroup }) {
  const t = useTranslations("groupSignup");
  const labels = useLabels();
  const locale = useLocale();
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="badge-brand">{labels.sport(g.sport)}</span>
        <span className="badge bg-ink-50 text-ink-800">
          {g.kind === "dropin" ? t("dropin") : <WhoFor g={g} />}
        </span>
      </div>
      <div className="text-lg font-semibold leading-snug text-ink-900">{g.name}</div>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
        <Clock size={14} className="shrink-0" aria-hidden="true" />
        {scheduleText(g, locale)}
      </p>
      {(g.coach_name || g.court_name) && (
        <p className="mt-0.5 text-sm text-ink-600">
          {[g.coach_name && t("with", { coach: g.coach_name }), g.court_name].filter(Boolean).join(" · ")}
        </p>
      )}
      {g.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-600">{g.description}</p>}
    </>
  );
}

function SeasonCard({
  g,
  viewer,
  loginHref,
  onJoin,
}: {
  g: PublicGroup;
  viewer: Viewer;
  loginHref: string;
  onJoin: (trial: boolean) => void;
}) {
  const t = useTranslations("groupSignup");
  const left = g.max_players - g.taken;
  const full = left <= 0;
  return (
    <div className="card flex flex-col p-6">
      <Header g={g} />
      <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-ink-100 pt-4">
        <span className="text-xl font-bold tracking-tight text-ink-900">
          {money(Number(g.price))}
          <span className="text-sm font-normal tracking-normal text-ink-600"> {t("perMonth")}</span>
        </span>
        <span className={`text-xs font-semibold ${full ? "text-ink-600" : "text-brand-900"}`}>
          {full ? (g.waiting ? t("fullWaiting", { n: g.waiting }) : t("full")) : t("placesLeft", { n: left })}
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {viewer === "visitor" ? (
          <Link href={loginHref} className="btn-primary justify-center">
            {t("signInToJoin")}
          </Link>
        ) : viewer === "admin" ? null : (
          <>
            <button type="button" onClick={() => onJoin(false)} className="btn-primary justify-center">
              {full ? t("joinWaiting") : g.coach_approves ? t("askToJoin") : t("join")}
            </button>
            {!full && g.trial && !g.coach_approves && (
              <button type="button" onClick={() => onJoin(true)} className="btn-secondary">
                {t("tryFree")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DropinCard({ g, viewer, loginHref }: { g: PublicGroup; viewer: Viewer; loginHref: string }) {
  const t = useTranslations("groupSignup");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (task: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await task();
      if (r.error) setError(t(`errors.${r.error}`));
      router.refresh();
    });

  return (
    <div className="card flex flex-col p-6">
      <Header g={g} />
      <div className="mt-4 border-t border-ink-100 pt-4 text-xl font-bold tracking-tight text-ink-900">
        {money(Number(g.price))}
        <span className="text-sm font-normal tracking-normal text-ink-600"> {t("perSession")}</span>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <ul className="mt-3 flex flex-col">
        {g.sessions.length === 0 && <li className="text-sm text-ink-600">{t("noSessions")}</li>}
        {g.sessions.map((s) => {
          const left = g.max_players - s.taken;
          return (
            <li key={s.id} className="flex items-center justify-between gap-2 border-b border-ink-50 py-2.5 last:border-0">
              <span className="text-[13px]">
                <span className="font-medium text-ink-900">
                  {clubFormat(s.starts_at, locale, { weekday: "short", day: "numeric", month: "short" })}
                </span>{" "}
                <span className="text-ink-600">
                  {clubTime(s.starts_at)} · {left > 0 ? t("placesLeft", { n: left }) : t("full")}
                </span>
              </span>
              {viewer === "visitor" ? (
                <Link href={loginHref} className="shrink-0 text-[13px] font-semibold text-brand-900 underline underline-offset-2">
                  {t("signIn")}
                </Link>
              ) : viewer === "admin" ? null : s.mine ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => unbookSession(s.id))}
                  className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-900"
                >
                  {t("booked")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending || left <= 0}
                  onClick={() => act(() => bookSession(s.id, ""))}
                  className="shrink-0 rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {t("book")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function JoinModal({
  group,
  trial,
  myName,
  onClose,
  onDone,
}: {
  group: PublicGroup;
  trial: boolean;
  myName: string | null;
  onClose: () => void;
  onDone: (status: string, name: string) => void;
}) {
  const t = useTranslations("groupSignup");
  const router = useRouter();
  const [forSelf, setForSelf] = useState(!!group.adults);
  const [name, setName] = useState(group.adults ? (myName ?? "") : "");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const full = group.taken >= group.max_players;

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const r = await joinGroup(group.id, {
        name,
        age: age ? Number(age) : null,
        phone,
        forSelf,
        trial,
      });
      if (r.error) {
        setError(
          r.error === "age"
            ? t("errors.age", { from: group.age_min ?? 3, to: group.age_max ?? 99 })
            : t(`errors.${r.error}`),
        );
        return;
      }
      onDone(r.status ?? "active", name.trim());
      onClose();
      router.refresh();
    });

  return (
    <Modal open onClose={onClose}>
      <Modal.Content className="max-h-[90vh] max-w-md overflow-y-auto">
        <Modal.Header>{trial ? t("trialTitle", { group: group.name }) : t("joinTitle", { group: group.name })}</Modal.Header>
        <Modal.Body>
          {error && (
            <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          <p className="text-sm text-ink-600">
            {full ? t("fullNote") : group.coach_approves ? t("approveNote") : trial ? t("trialNote") : t("joinNote")}
          </p>
          <div role="radiogroup" aria-label={t("who")} className="grid grid-cols-2 gap-2">
            {[false, true].map((self) => (
              <button
                key={String(self)}
                type="button"
                role="radio"
                aria-checked={forSelf === self}
                onClick={() => {
                  setForSelf(self);
                  if (self && !name) setName(myName ?? "");
                  if (!self && name === myName) setName("");
                }}
                className={`rounded-xl border px-3 py-2.5 text-sm ${
                  forSelf === self ? "border-ink-900 bg-ink-900 font-semibold text-white" : "border-ink-200 bg-white text-ink-800"
                }`}
              >
                {self ? t("me") : t("myChild")}
              </button>
            ))}
          </div>
          <Modal.Grid>
            <Modal.Field label={forSelf ? t("yourName") : t("childName")} required htmlFor="gj-childName">
              <input id="gj-childName" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </Modal.Field>
            <Modal.Field label={t("age")} htmlFor="gj-age">
              <input id="gj-age" className="input" type="number" min={3} max={99} value={age} onChange={(e) => setAge(e.target.value)} />
            </Modal.Field>
          </Modal.Grid>
          <Modal.Field label={t("phone")} htmlFor="gj-phone">
            <input id="gj-phone" className="input" type="tel" value={phone} maxLength={40} onChange={(e) => setPhone(e.target.value)} />
          </Modal.Field>
          <p className="text-xs text-ink-600">{t("contactNote")}</p>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !name.trim()}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {pending ? t("sending") : full ? t("joinWaiting") : trial ? t("bookTrial") : group.coach_approves ? t("askToJoin") : t("join")}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
