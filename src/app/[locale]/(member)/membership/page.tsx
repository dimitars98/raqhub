import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import type { Member, MembershipPlan } from "@/types/database";

type MemberWithPlan = Member & { plan?: MembershipPlan | null };

export default async function MembershipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: memberData }, { data: plansData }] = await Promise.all([
    user.email
      ? supabase
          .from("members")
          .select("*, plan:membership_plans(*)")
          .eq("email", user.email)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("membership_plans").select("*").order("price"),
  ]);

  const member = memberData as MemberWithPlan | null;
  const plans = (plansData ?? []) as MembershipPlan[];

  const STATUS_STYLE: Record<string, string> = {
    active:
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800",
    cancelled:
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-500",
    expired:
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700",
  };

  return (
    <div>
      <h1 className="text-2xl font-medium text-brand-900 mb-1">Membership</h1>
      <p className="text-sm text-brand-400 mb-8">
        Your plan and other available options
      </p>

      {/* Current membership */}
      <section className="mb-10">
        <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-4">
          Your plan
        </h2>
        {!member ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-brand-400 mb-2">
              You&apos;re not a member yet
            </p>
            <p className="text-xs text-brand-400">
              Contact your club to get added as a member.
            </p>
          </div>
        ) : (
          <div className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-brand-900">
                  {member.plan?.name ?? "No plan assigned"}
                </div>
                <div className="text-xs text-brand-400 mt-0.5">
                  {member.plan
                    ? `€${member.plan.price} / ${member.plan.billing_period}`
                    : "Speak with your club admin"}
                </div>
              </div>
              <span className={STATUS_STYLE[member.status]}>
                {member.status}
              </span>
            </div>
            {member.plan?.discount_pct && member.plan.discount_pct > 0 && (
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 mb-3">
                {member.plan.discount_pct}% off every booking
              </div>
            )}
            {member.ends_at && (
              <div className="text-xs text-brand-500 pt-3 border-t border-brand-100">
                Expires {format(new Date(member.ends_at), "d MMM yyyy")}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Available plans */}
      {!!plans.length && (
        <section>
          <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-4">
            Available plans
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
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-medium text-brand-900 mb-1">
                    €{p.price}
                  </div>
                  <div className="text-xs text-brand-400 mb-3 capitalize">
                    {p.billing_period}
                  </div>
                  {p.description && (
                    <p className="text-xs text-brand-500 mb-3">
                      {p.description}
                    </p>
                  )}
                  {p.discount_pct > 0 && (
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800">
                      {p.discount_pct}% discount on bookings
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-brand-400 mt-5 text-center">
            To change plans, contact your club admin.
          </p>
        </section>
      )}
    </div>
  );
}
