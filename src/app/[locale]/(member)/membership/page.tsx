import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getTranslations } from "next-intl/server";
import type { MembershipPlan, MyMembership } from "@/types/database";
import { getLabels } from "@/lib/getLabels";
import { intlLocale } from "@/lib/dateLocale";
import { BADGE, memberStatusTone } from "@/lib/badges";

export default async function MembershipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const t = await getTranslations("membershipPage");
  const locale = await getLocale();
  const labels = await getLabels();

  // The player's own membership comes from a database function; the members
  // table itself is only readable by the club. Active memberships come first.
  const { data: membershipData } = await supabase.rpc("my_memberships");
  const member =
    ((membershipData ?? []) as unknown as MyMembership[])[0] ?? null;

  // Only the plans of the club the player belongs to.
  const { data: plansData } = member
    ? await supabase
        .from("membership_plans")
        .select("*")
        .eq("club_id", member.club_id)
        .order("price")
    : { data: [] };
  const plans = (plansData ?? []) as MembershipPlan[];

  return (
    <div>
      <h1 className="text-2xl font-medium text-brand-900 mb-1">{t("title")}</h1>
      <p className="text-sm text-brand-400 mb-8">
        {t("subtitle")}
      </p>

      {/* Current membership */}
      <section className="mb-10">
        <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-4">
          {t("yourPlan")}
        </h2>
        {!member ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-brand-400 mb-2">
              {t("notMember")}
            </p>
            <p className="text-xs text-brand-400">
              {t("notMemberHint")}
            </p>
          </div>
        ) : (
          <div className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-brand-900">
                  {member.plan?.name ?? t("noPlan")}
                </div>
                <div className="text-xs text-brand-400 mt-0.5">
                  {member.plan
                    ? `€${member.plan.price} ${labels.billingPeriod(member.plan.billing_period)}`
                    : t("noPlanHint")}
                </div>
              </div>
              <span className={`${BADGE} ${memberStatusTone(member.status)}`}>
                {labels.memberStatus(member.status)}
              </span>
            </div>
            {member.plan?.discount_pct && member.plan.discount_pct > 0 && (
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 mb-3">
                {t("discountEvery", { pct: member.plan.discount_pct })}
              </div>
            )}
            {member.ends_at && (
              <div className="text-xs text-brand-500 pt-3 border-t border-brand-100">
                {t("expires", {
                  date: new Intl.DateTimeFormat(intlLocale(locale), {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(new Date(member.ends_at)),
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Available plans */}
      {!!plans.length && (
        <section>
          <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-4">
            {t("availablePlans", { club: member?.club?.name ?? "" })}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((p) => {
              const isCurrent = member?.plan?.id === p.id;
              return (
                <div
                  key={p.id}
                  className={`p-5 rounded-2xl ${
                    isCurrent
                      ? "bg-white border-2 border-brand-600"
                      : "bg-white border border-brand-100"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-sm font-medium text-brand-900">
                      {p.name}
                    </div>
                    {isCurrent && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800">
                        {t("current")}
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-medium text-brand-900 mb-1">
                    €{p.price}
                  </div>
                  <div className="text-xs text-brand-400 mb-3 capitalize">
                    {labels.billingPeriod(p.billing_period)}
                  </div>
                  {p.description && (
                    <p className="text-xs text-brand-500 mb-3">
                      {p.description}
                    </p>
                  )}
                  {p.discount_pct > 0 && (
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800">
                      {t("discountBookings", { pct: p.discount_pct })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-brand-400 mt-5 text-center">
            {t("changePlan")}
          </p>
        </section>
      )}
    </div>
  );
}
