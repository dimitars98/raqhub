import { Check } from "lucide-react";
import { Link } from "@/i18n/navigation";

const PLANS = [
  {
    name: "Starter",
    tagline: "For a single court, or to try it out.",
    price: "€0",
    period: "Free forever",
    featured: false,
    cta: "Get started free",
    href: "/signup?role=admin",
    features: [
      "1 court",
      "Up to 20 members",
      "Basic bookings",
      "Email support",
    ],
  },
  {
    name: "Club",
    tagline: "For clubs taking bookings every day.",
    price: "€29",
    period: "Billed monthly",
    featured: true,
    cta: "Start 14-day trial",
    href: "/signup?role=admin",
    features: [
      "Unlimited courts",
      "Unlimited members",
      "Membership plans",
      "Email notifications",
      "Stripe payments",
    ],
  },
  {
    name: "Academy",
    tagline: "For academies with coaches and staff.",
    price: "€79",
    period: "Billed monthly",
    featured: false,
    cta: "Contact us",
    href: "/signup?role=admin",
    features: [
      "Everything in Club",
      "Multiple admins",
      "Coach management",
      "Advanced analytics",
      "Priority support",
    ],
  },
];

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="border-y border-ink-100 bg-ink-50 px-6 py-16 lg:px-10 lg:py-24"
    >
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-12 text-center lg:mb-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-100 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-900">
            <span className="size-1.5 rounded-full bg-brand-600" />
            Simple pricing
          </div>
          <h2 className="font-display mb-3 text-[28px] font-extrabold leading-[1.1] tracking-tight text-ink-900 sm:text-[34px] lg:text-[44px]">
            No surprises.{" "}
            <span className="underline decoration-brand-400 decoration-[6px] underline-offset-[6px]">
              No hidden fees.
            </span>
          </h2>
          <p className="text-base text-ink-600">
            Start free, upgrade when you grow. Cancel anytime.
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
                    Most popular
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
                  /mo
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
      </div>
    </section>
  );
}
