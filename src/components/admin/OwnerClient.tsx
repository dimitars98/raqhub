"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import Modal from "@/components/ui/Modal";
import { PLANS, type PlanId } from "@/lib/plans";
import { nextPaidUntil, type Period } from "@/lib/ownerBilling";
import {
  extendTrial,
  recordPayment,
  setPaidUntil,
  setPlan,
} from "@/app/[locale]/admin/owner/actions";
import SelectField from "@/components/ui/SelectField";

export type OwnerClub = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  createdAt: string | null;
  plan: PlanId;
  status: "trial" | "grace" | "active" | "locked";
  trialEndsAt: string | null;
  /** When the club becomes / became read-only (grace and locked only). */
  readOnlyFrom: string | null;
  paidUntil: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  courts: number;
  bookings30: number;
};

export type OwnerPayment = {
  id: string;
  clubName: string;
  plan: string;
  period: Period;
  method: "bank" | "cash" | "card";
  amount: number;
  paidUntil: string;
  createdAt: string;
};

type Stats = {
  clubs: number;
  trial: number;
  paying: number;
  unpaid: number;
  monthly: number;
  receivedThisMonth: number;
};

type Filter = "all" | "trial" | "active" | "unpaid";
const PLAN_IDS = Object.keys(PLANS) as PlanId[];

const STATUS_STYLE: Record<OwnerClub["status"], string> = {
  trial: "bg-court-50 text-court-800",
  active: "bg-brand-100 text-brand-900",
  grace: "bg-red-50 text-red-800",
  locked: "bg-ink-900 text-white",
};

const money = (n: number) => `€${n.toLocaleString("en", { maximumFractionDigits: 2 })}`;

export default function OwnerClient({
  clubs,
  payments,
  stats,
  today,
}: {
  clubs: OwnerClub[];
  payments: OwnerPayment[];
  stats: Stats;
  today: string;
}) {
  const t = useTranslations("owner");
  const tPlan = useTranslations("billing.planNames");
  const locale = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [managing, setManaging] = useState<OwnerClub | null>(null);

  // date-fns rather than Intl: browsers don't all ship every language
  // (Macedonian, Albanian), and server and browser must print the same.
  const day = useMemo(() => {
    const options = { locale: dateLocale(locale) };
    // Plain dates (yyyy-mm-dd) are read at noon so no time zone shifts the day.
    return (d: string) =>
      format(new Date(d.length === 10 ? `${d}T12:00:00` : d), "d MMM yyyy", options);
  }, [locale]);

  const shown = clubs
    // "Not paid" covers both the grace days and read-only clubs.
    .filter((c) =>
      filter === "all" ||
      c.status === filter ||
      (filter === "unpaid" && (c.status === "grace" || c.status === "locked")),
    )
    .filter((c) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [c.name, c.city, c.ownerName, c.ownerEmail, c.slug]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });

  const statusText = (c: OwnerClub) =>
    c.status === "trial" && c.trialEndsAt
      ? t("status.trialUntil", { date: day(c.trialEndsAt) })
      : c.status === "active" && c.paidUntil
        ? t("status.paidUntil", { date: day(c.paidUntil) })
        : c.readOnlyFrom
          ? t(c.status === "grace" ? "status.readOnlyFrom" : "status.readOnlySince", {
              date: day(c.readOnlyFrom),
            })
          : t("status.unpaid");

  const tiles: [string, string, string?][] = [
    [t("stats.clubs"), String(stats.clubs)],
    [t("stats.trial"), String(stats.trial)],
    [t("stats.paying"), String(stats.paying)],
    [t("stats.unpaid"), String(stats.unpaid), stats.unpaid > 0 ? "text-amber-700" : undefined],
    [t("stats.monthly"), money(stats.monthly)],
    [t("stats.received"), money(stats.receivedThisMonth)],
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-400">{t("subtitle")}</p>
      </div>

      {/* Numbers */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-ink-100 bg-white p-4">
            <p className="text-xs text-ink-400">{label}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${tone ?? "text-ink-900"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "trial", "active", "unpaid"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === f ? "bg-brand-900 text-white" : "bg-white text-ink-600 hover:bg-ink-50"
            }`}
          >
            {t(`filters.${f}`)}
          </button>
        ))}
        <input
          className="input ml-auto w-full max-w-xs"
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Clubs */}
      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-[#f8f9f7] text-left text-xs font-semibold text-ink-400">
              <th className="px-5 py-3">{t("cols.club")}</th>
              <th className="px-5 py-3">{t("cols.owner")}</th>
              <th className="px-5 py-3">{t("cols.plan")}</th>
              <th className="px-5 py-3">{t("cols.status")}</th>
              <th className="px-5 py-3 text-right">{t("cols.usage")}</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink-400">
                  {t("empty")}
                </td>
              </tr>
            )}
            {shown.map((c) => (
              <tr key={c.id} className="border-b border-ink-100 last:border-0 hover:bg-[#f8f9f7]">
                <td className="px-5 py-3.5">
                  <Link href={`/clubs/${c.slug}`} className="font-medium text-ink-900 hover:underline">
                    {c.name}
                  </Link>
                  <div className="mt-0.5 text-xs text-ink-400">
                    {[c.city, c.country].filter(Boolean).join(", ") || "–"}
                    {c.createdAt ? " · " : null}
                    {c.createdAt ? t("joined", { date: day(c.createdAt) }) : null}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="text-ink-600">{c.ownerName ?? "–"}</div>
                  {c.ownerEmail && (
                    <a href={`mailto:${c.ownerEmail}`} className="text-xs text-ink-400 hover:text-ink-900">
                      {c.ownerEmail}
                    </a>
                  )}
                </td>
                <td className="px-5 py-3.5 text-ink-600">
                  {tPlan(c.plan)}
                  <div className="text-xs text-ink-400">
                    {t("perMonth", { price: PLANS[c.plan].priceMonthly })}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                    {statusText(c)}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right text-xs text-ink-600">
                  {t("courts", { n: c.courts })}
                  <div className="text-ink-400">{t("bookings30", { n: c.bookings30 })}</div>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => setManaging(c)}
                    className="whitespace-nowrap text-xs font-semibold text-brand-600 hover:text-brand-800"
                  >
                    {t("manage")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments */}
      <h2 className="mb-3 mt-10 text-base font-semibold text-ink-900">{t("payments.title")}</h2>
      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        {payments.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">{t("payments.empty")}</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-[#f8f9f7] text-left text-xs font-semibold text-ink-400">
                <th className="px-5 py-3">{t("payments.date")}</th>
                <th className="px-5 py-3">{t("cols.club")}</th>
                <th className="px-5 py-3">{t("cols.plan")}</th>
                <th className="px-5 py-3">{t("payments.method")}</th>
                <th className="px-5 py-3">{t("payments.paidUntil")}</th>
                <th className="px-5 py-3 text-right">{t("payments.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-5 py-3 text-ink-600">{day(p.createdAt)}</td>
                  <td className="px-5 py-3 font-medium text-ink-900">{p.clubName}</td>
                  <td className="px-5 py-3 text-ink-600">
                    {p.plan in PLANS ? tPlan(p.plan as PlanId) : p.plan} · {t(`period.${p.period}`)}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{t(`method.${p.method}`)}</td>
                  <td className="px-5 py-3 text-ink-600">{day(p.paidUntil)}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-ink-900">
                    {money(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {managing && (
        <ManageClub key={managing.id} club={managing} today={today} day={day} onClose={() => setManaging(null)} />
      )}
    </div>
  );
}

function ManageClub({
  club,
  today,
  day,
  onClose,
}: {
  club: OwnerClub;
  today: string;
  day: (d: string) => string;
  onClose: () => void;
}) {
  const t = useTranslations("owner");
  const tPlan = useTranslations("billing.planNames");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [plan, setPlanChoice] = useState<PlanId>(club.plan);
  const [period, setPeriod] = useState<Period>("year");
  const [method, setMethod] = useState<"bank" | "cash">("bank");
  const [amount, setAmount] = useState(String(PLANS[club.plan].priceYearly));
  const [paidUntilInput, setPaidUntilInput] = useState(club.paidUntil ?? "");

  const priceFor = (p: PlanId, per: Period) =>
    per === "year" ? PLANS[p].priceYearly : PLANS[p].priceMonthly;

  const preview = nextPaidUntil({
    today,
    trialEndsOn: club.trialEndsAt ? club.trialEndsAt.slice(0, 10) : null,
    paidUntil: club.paidUntil,
    period,
  });

  const run = (action: () => Promise<{ error?: string }>, okText: string, close = false) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setMessage({ ok: false, text: t(`errors.${result.error}` as "errors.failed") });
        return;
      }
      router.refresh();
      if (close) onClose();
      else setMessage({ ok: true, text: okText });
    });
  };

  const segment = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100"
    }`;

  return (
    <Modal open onClose={onClose}>
      <Modal.Content className="max-h-[90vh] max-w-lg overflow-y-auto">
        <Modal.Header>{club.name}</Modal.Header>
        <Modal.Body>
          {message && (
            <div
              className={`rounded-lg px-3 py-2 text-xs ${
                message.ok ? "bg-brand-50 text-brand-900" : "border border-red-100 bg-red-50 text-red-600"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Record a payment */}
          <p className="text-sm font-semibold text-ink-900">{t("pay.title")}</p>
          <Modal.Grid>
            <Modal.Field label={t("cols.plan")}>
              <SelectField
                ariaLabel={t("cols.plan")}
                value={plan}
                onChange={(v) => {
                  const p = v as PlanId;
                  setPlanChoice(p);
                  setAmount(String(priceFor(p, period)));
                }}
                options={PLAN_IDS.map((p) => ({ value: p, label: tPlan(p) }))}
              />
            </Modal.Field>
            <Modal.Field label={t("payments.amount")}>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Modal.Field>
          </Modal.Grid>
          <div className="flex gap-2">
            {(["month", "year"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                className={segment(period === p)}
                onClick={() => {
                  setPeriod(p);
                  setAmount(String(priceFor(plan, p)));
                }}
              >
                {t(`period.${p}`)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["bank", "cash"] as const).map((m) => (
              <button key={m} type="button" className={segment(method === m)} onClick={() => setMethod(m)}>
                {t(`method.${m}`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-400">{t("pay.preview", { date: day(preview) })}</p>
          <button
            type="button"
            disabled={pending || amount === "" || Number(amount) < 0}
            className="btn-primary justify-center disabled:opacity-50"
            onClick={() =>
              run(
                () =>
                  recordPayment({ clubId: club.id, plan, period, method, amount: Number(amount) }),
                t("pay.saved"),
                true,
              )
            }
          >
            {t("pay.save")}
          </button>

          {/* Other changes */}
          <div className="mt-4 border-t border-ink-100 pt-4">
            <p className="text-sm font-semibold text-ink-900">{t("other.title")}</p>
          </div>

          <Modal.Field label={t("other.planOnly")}>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <SelectField
                  ariaLabel={t("other.planOnly")}
                  value={plan}
                  onChange={(v) => setPlanChoice(v as PlanId)}
                  options={PLAN_IDS.map((p) => ({ value: p, label: tPlan(p) }))}
                />
              </div>
              <button
                type="button"
                disabled={pending || plan === club.plan}
                className="btn-secondary disabled:opacity-50"
                onClick={() => run(() => setPlan(club.id, plan), t("other.saved"))}
              >
                {t("other.save")}
              </button>
            </div>
          </Modal.Field>

          <Modal.Field label={t("other.extendTrial")}>
            <div className="flex gap-2">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={pending}
                  className="btn-secondary flex-1 disabled:opacity-50"
                  onClick={() => run(() => extendTrial(club.id, d), t("other.saved"))}
                >
                  {t("other.days", { n: d })}
                </button>
              ))}
            </div>
          </Modal.Field>

          <Modal.Field label={t("other.paidUntil")}>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="date"
                value={paidUntilInput}
                onChange={(e) => setPaidUntilInput(e.target.value)}
              />
              <button
                type="button"
                disabled={pending || paidUntilInput === (club.paidUntil ?? "")}
                className="btn-secondary disabled:opacity-50"
                onClick={() =>
                  run(() => setPaidUntil(club.id, paidUntilInput || null), t("other.saved"))
                }
              >
                {t("other.save")}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-ink-400">{t("other.paidUntilHint")}</p>
          </Modal.Field>
        </Modal.Body>
      </Modal.Content>
    </Modal>
  );
}
