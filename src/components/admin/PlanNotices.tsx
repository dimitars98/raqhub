import { getFormatter, getTranslations } from "next-intl/server";
import { Lock, Mail, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  PLANS,
  SALES_EMAIL,
  planFor,
  type ClubAccess,
  type ClubBilling,
  type Feature,
} from "@/lib/plans";

/** Strip above every admin page: trial days left, or "trial is over". */
export async function PlanBanner({ access }: { access: ClubAccess }) {
  if (access.status === "active") return null;
  const t = await getTranslations("billing");
  const unpaid = access.status === "unpaid";

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
        unpaid
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-brand-100 bg-brand-100/40 text-ink-800"
      }`}
    >
      <span className="flex items-center gap-2">
        <Sparkles size={15} className="shrink-0" aria-hidden="true" />
        {unpaid ? t("unpaidBanner") : t("trialBanner", { days: access.trialDaysLeft })}
      </span>
      {unpaid ? (
        <a href={`mailto:${SALES_EMAIL}`} className="font-semibold underline underline-offset-2">
          {t("contact")}
        </a>
      ) : (
        <Link href="/admin/settings" className="font-semibold underline underline-offset-2">
          {t("seePlan")}
        </Link>
      )}
    </div>
  );
}

/** Shown instead of a page whose feature isn't in the club's plan. */
export async function UpgradeNotice({ feature }: { feature: Feature }) {
  const t = await getTranslations("billing");
  const plan = t(`planNames.${planFor(feature)}`);

  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center">
      <div className="mx-auto mb-4 grid size-11 place-items-center rounded-xl bg-brand-100 text-brand-900">
        <Lock size={18} aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold text-ink-900">
        {t("lockedTitle", { feature: t(`features.${feature}`), plan })}
      </h1>
      <p className="mt-2 text-sm text-ink-600">{t("lockedBody", { plan })}</p>
      <a href={`mailto:${SALES_EMAIL}`} className="btn-primary mt-6 inline-flex items-center gap-2">
        <Mail size={15} aria-hidden="true" />
        {t("contact")}
      </a>
    </div>
  );
}

/** "Your ServeTime plan" box on the settings page. */
export async function PlanCard({ club, access }: { club: ClubBilling; access: ClubAccess }) {
  const t = await getTranslations("billing");
  const format = await getFormatter();
  const plan = PLANS[access.plan];
  const day = (iso: string) =>
    format.dateTime(new Date(iso), { day: "numeric", month: "long", year: "numeric" });

  const status =
    access.status === "trial" && club.trial_ends_at
      ? t("trialUntil", { date: day(club.trial_ends_at) })
      : access.status === "active" && club.paid_until
        ? t("paidUntil", { date: day(club.paid_until) })
        : t("unpaid");

  return (
    <div className="mx-auto mb-6 max-w-[900px] rounded-2xl border border-ink-100 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-400">
            {t("cardTitle")}
          </p>
          <p className="mt-1 text-xl font-semibold text-ink-900">
            {t(`planNames.${access.plan}`)}{" "}
            <span className="text-sm font-normal text-ink-600">
              · {t("perMonth", { price: plan.priceMonthly })}
            </span>
          </p>
          <p
            className={`mt-1 text-sm ${
              access.status === "unpaid" ? "text-amber-700" : "text-brand-600"
            }`}
          >
            {status}
          </p>
        </div>
        <div className="text-sm text-ink-600">
          {t("courts")}:{" "}
          <span className="font-semibold text-ink-900">
            {plan.maxCourts ?? t("unlimited")}
          </span>
        </div>
      </div>
      {access.status === "trial" && (
        <p className="mt-3 text-sm text-ink-600">{t("trialNote")}</p>
      )}
      <p className="mt-3 text-sm text-ink-600">
        {t("changePlan", { email: SALES_EMAIL })}
      </p>
    </div>
  );
}
