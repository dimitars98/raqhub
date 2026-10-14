import { getTranslations } from "next-intl/server";
import { Check, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

export type SetupProgress = {
  courts: boolean;
  hours: boolean;
  /** Undefined when the club's plan has no membership plans. */
  plans?: boolean;
  members: boolean;
  /** A player has booked online, so the link has reached players. */
  shared: boolean;
};

const STEPS = [
  { key: "courts", href: "/admin/courts" },
  { key: "hours", href: "/admin/settings?tab=hours" },
  { key: "plans", href: "/admin/plans" },
  { key: "members", href: "/admin/members" },
  { key: "shared", href: "/admin/share" },
] as const;

/**
 * "Get your club ready" list on the admin dashboard. Every step ticks itself
 * off from the club's own data, and the whole box disappears once all are
 * done, so a club never has to tell us it finished.
 */
export default async function GettingStarted({ progress }: { progress: SetupProgress }) {
  const t = await getTranslations("onboarding");
  const steps = STEPS.filter((s) => progress[s.key] !== undefined);
  const done = steps.filter((s) => progress[s.key]).length;
  if (done === steps.length) return null;

  // The first unfinished step is the one to do now.
  const next = steps.find((s) => !progress[s.key])?.key;

  return (
    <section className="mb-8 rounded-2xl border border-ink-100 bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">{t("title")}</h2>
          <p className="text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        <p className="text-sm font-medium text-brand-600">
          {t("progress", { done, total: steps.length })}
        </p>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>

      <ol className="space-y-2">
        {steps.map(({ key, href }) => {
          const isDone = !!progress[key];
          const isNext = key === next;
          return (
            <li
              key={key}
              className={`flex items-start gap-3 rounded-xl px-3 py-3 ${
                isNext ? "bg-brand-100/40" : ""
              }`}
            >
              <span
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border ${
                  isDone
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-ink-200 bg-white text-transparent"
                }`}
                aria-hidden="true"
              >
                <Check size={13} strokeWidth={3} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    isDone ? "text-ink-400 line-through" : "text-ink-900"
                  }`}
                >
                  {t(`steps.${key}.title`)}
                  <span className="sr-only"> — {isDone ? t("done") : t("todo")}</span>
                </p>
                {!isDone && (
                  <p className="mt-0.5 text-sm text-ink-600">{t(`steps.${key}.body`)}</p>
                )}
              </div>
              {!isDone && (
                <Link
                  href={href}
                  className={`shrink-0 self-center whitespace-nowrap text-sm font-semibold ${
                    isNext
                      ? "btn-primary inline-flex items-center gap-1.5"
                      : "text-brand-600 hover:underline"
                  }`}
                >
                  {t(`steps.${key}.cta`)}
                  {isNext && <ArrowRight size={14} aria-hidden="true" />}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
