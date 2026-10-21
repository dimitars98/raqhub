import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PLANS as PLAN_LIMITS } from "@/lib/plans";

// Prices and court limits come from src/lib/plans.ts, so the page and the app
// never disagree. Texts are in the "pricing" messages.
const PLAN_ORDER = ["starter", "club", "academy"] as const;
const FEATURED = "club";

export default function Pricing() {
  const t = useTranslations("pricing");
  const PLANS = PLAN_ORDER.map((id) => {
    const limits = PLAN_LIMITS[id];
    return {
      name: t(`plans.${id}.name`),
      tagline: t(`plans.${id}.tagline`),
      price: `€${limits.priceMonthly}`,
      period: t("yearly", {
        price: limits.priceYearly,
        save: limits.priceMonthly * 12 - limits.priceYearly,
      }),
      featured: id === FEATURED,
      cta: t("cta"),
      href: "/signup?role=admin",
      features: (t.raw(`plans.${id}.features`) as string[]).map((line) =>
        line.replace("{courts}", String(limits.maxCourts)),
      ),
    };
  });
  return (
    <section
      id="pricing"
      className="border-y border-ink-100 bg-ink-50 px-6 py-16 lg:px-10 lg:py-24"
    >
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-12 text-center lg:mb-16">
          <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-widest text-[#4d7a08]">
            {t("label")}
          </div>
          <h2 className="font-display mb-3 text-[28px] font-extrabold leading-[1.1] tracking-tight text-ink-900 sm:text-[34px] lg:text-[44px]">
            {t("title1")}{" "}
            <span className="underline decoration-brand-400 decoration-[6px] underline-offset-[6px]">
              {t("title2")}
            </span>
          </h2>
          <p className="text-base text-ink-600">
            {t("subtitle")}
          </p>
        </div>

        <div className="mx-auto grid max-w-md grid-cols-1 gap-8 md:max-w-none md:grid-cols-3 md:items-stretch md:gap-5">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col overflow-hidden rounded-[1.75rem] p-7 md:p-6 lg:p-8 ${
                p.featured
                  ? // Stands a little taller than its neighbours on desktop
                    "bg-ink-900 text-white shadow-xl shadow-ink-900/20 lg:-my-4 lg:py-12"
                  : "border border-ink-100 bg-white transition-colors hover:border-brand-400"
              }`}
            >
              {/* Faint court lines in the corner of the featured card */}
              {p.featured && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 200 200"
                  fill="none"
                  className="pointer-events-none absolute -right-12 -top-12 size-56 rotate-12 text-brand-400 opacity-20"
                >
                  <g stroke="currentColor" strokeWidth="3">
                    <rect x="20" y="20" width="160" height="160" />
                    <line x1="50" y1="20" x2="50" y2="180" />
                    <line x1="150" y1="20" x2="150" y2="180" />
                    <line x1="50" y1="100" x2="150" y2="100" />
                    <line x1="100" y1="100" x2="100" y2="180" />
                  </g>
                </svg>
              )}

              <div className="relative flex items-center justify-between gap-3">
                <h3
                  className={`text-lg font-bold tracking-tight ${
                    p.featured ? "text-white" : "text-ink-900"
                  }`}
                >
                  {p.name}
                </h3>
                {p.featured && (
                  <span className="whitespace-nowrap rounded-full bg-brand-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-900">
                    {t("mostPopular")}
                  </span>
                )}
              </div>
              <p
                className={`relative mt-1 text-sm ${
                  p.featured ? "text-white/60" : "text-ink-600"
                }`}
              >
                {p.tagline}
              </p>

              <div
                className={`font-display relative mt-7 text-[56px] font-extrabold leading-none tracking-[-2px] ${
                  p.featured ? "text-brand-400" : "text-ink-900"
                }`}
              >
                {p.price}
                <span
                  className={`text-base font-normal tracking-normal ${
                    p.featured ? "text-white/60" : "text-ink-600"
                  }`}
                >
                  {" "}
                  {t("perMonth")}
                </span>
              </div>
              <div
                className={`relative mt-2 text-sm ${
                  p.featured ? "text-white/60" : "text-ink-600"
                }`}
              >
                {p.period}
              </div>

              <div
                className={`my-7 h-px ${
                  p.featured ? "bg-white/15" : "bg-ink-100"
                }`}
              />

              <ul className="relative mb-8 space-y-3.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-[15px]">
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full ${
                        p.featured
                          ? "bg-brand-400 text-ink-900"
                          : "bg-brand-100 text-brand-900"
                      }`}
                    >
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span
                      className={p.featured ? "text-white/90" : "text-ink-800"}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={p.href}
                className={`relative mt-auto flex h-12 items-center justify-center rounded-full text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
                  p.featured
                    ? "bg-brand-400 text-ink-900 hover:bg-white focus-visible:ring-offset-ink-900"
                    : "border border-ink-200 text-ink-900 hover:border-ink-900 hover:bg-ink-900 hover:text-white"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Things every plan has, so no card has to repeat them */}
        <div className="mt-8 rounded-3xl border border-ink-100 bg-white px-6 py-5 sm:px-8">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#4d7a08]">
            {t("everyPlan.title")}
          </div>
          <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {(t.raw("everyPlan.items") as string[]).map((item) => (
              <li key={item} className="flex items-center gap-3 text-[14px] text-ink-800">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-900">
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
