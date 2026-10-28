"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, Loader2 } from "lucide-react";
import { manageSubscription, startSubscription } from "@/app/[locale]/admin/settings/billing";
import { PLANS, type PlanId } from "@/lib/plans";
import type { Period } from "@/lib/ownerBilling";
import { intlLocale } from "@/lib/dateLocale";

export type CardSubscriptionInfo = {
  /** Plans and periods on sale by card (Polar products set up). */
  offered: { plan: PlanId; period: Period }[];
  currentPlan: PlanId;
  status: string | null;
  period: string | null;
  /** Cancelled: ends at paidUntil. */
  ends: boolean;
  paidUntil: string | null;
  /** Still in the free trial until this date. */
  trialEndsAt: string | null;
  /** Staff can't pay. */
  isOwner: boolean;
  sandbox: boolean;
};

/** Pay for the Kortello plan by card (Polar), or manage the card subscription. */
export default function CardSubscription({ info }: { info: CardSubscriptionInfo }) {
  const t = useTranslations("billing.card");
  const tPlan = useTranslations("billing.planNames");
  const locale = useLocale();
  const plans = [...new Set(info.offered.map((o) => o.plan))];
  const [plan, setPlan] = useState<PlanId>(plans.includes(info.currentPlan) ? info.currentPlan : plans[0]);
  const periods = info.offered.filter((o) => o.plan === plan).map((o) => o.period);
  const [period, setPeriod] = useState<Period>("month");
  const chosenPeriod = periods.includes(period) ? period : periods[0];
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const day = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Skopje",
    }).format(
      new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso),
    );

  const go = (action: () => Promise<{ url?: string; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await action();
      if (r.url) window.location.assign(r.url);
      else setError(t(`errors.${r.error ?? "failed"}`));
    });

  const live = ["active", "trialing", "past_due"].includes(info.status ?? "");
  const box = "mt-5 rounded-xl border border-ink-100 p-4";

  if (live) {
    return (
      <div className={box}>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <CreditCard size={16} aria-hidden="true" className="text-brand-600" />
          {t("payingTitle", { period: t(`periods.${info.period ?? "month"}`) })}
        </p>
        <p className={`mt-1 text-sm ${info.status === "past_due" ? "text-red-700" : "text-ink-600"}`}>
          {info.status === "past_due"
            ? t("pastDue")
            : info.paidUntil
              ? info.ends
                ? t("endsOn", { date: day(info.paidUntil) })
                : t("renewsOn", { date: day(info.paidUntil) })
              : null}
        </p>
        <button
          type="button"
          disabled={pending || !info.isOwner}
          onClick={() => go(manageSubscription)}
          className="btn-secondary mt-3 inline-flex items-center gap-2 text-[13px] disabled:opacity-50"
        >
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {t("manage")}
        </button>
        <p className="mt-2 text-xs text-ink-400">{t("manageHint")}</p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!plans.length) return null;
  const price = chosenPeriod === "year" ? PLANS[plan].priceYearly : PLANS[plan].priceMonthly;
  const seg = (on: boolean) =>
    `h-9 flex-1 rounded-lg px-3 text-[13px] transition-colors ${on ? "bg-white font-semibold text-ink-900 shadow-sm" : "text-ink-600"}`;

  return (
    <div className={box}>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <CreditCard size={16} aria-hidden="true" className="text-brand-600" />
        {t("title")}
      </p>
      <p className="mt-1 text-sm text-ink-600">{t("intro")}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {plans.length > 1 && (
          <div role="radiogroup" aria-label={t("plan")} className="flex gap-1 rounded-xl bg-ink-50 p-1">
            {plans.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={plan === p} onClick={() => setPlan(p)} className={seg(plan === p)}>
                {tPlan(p)}
              </button>
            ))}
          </div>
        )}
        {periods.length > 1 && (
          <div role="radiogroup" aria-label={t("period")} className="flex gap-1 rounded-xl bg-ink-50 p-1">
            {periods.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={chosenPeriod === p} onClick={() => setPeriod(p)} className={seg(chosenPeriod === p)}>
                {t(`periods.${p}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-sm text-ink-900">
        <span className="text-lg font-bold">€{price}</span>{" "}
        <span className="text-ink-600">{chosenPeriod === "year" ? t("perYear") : t("perMonth")}</span>
        {chosenPeriod === "year" && <span className="ml-2 text-xs font-medium text-brand-700">{t("twoMonthsFree")}</span>}
      </p>
      {info.trialEndsAt && new Date(info.trialEndsAt) > new Date() && (
        <p className="mt-1 text-xs text-ink-600">{t("trialNote", { date: day(info.trialEndsAt) })}</p>
      )}

      <button
        type="button"
        disabled={pending || !info.isOwner}
        onClick={() => go(() => startSubscription(plan, chosenPeriod))}
        className="btn-primary mt-3 inline-flex items-center gap-2 disabled:opacity-50"
      >
        {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        {t("pay")}
      </button>
      <p className="mt-2 text-xs text-ink-400">{info.sandbox ? t("sandbox") : t("secure")}</p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
