import type { ReactNode } from "react";
import { Trophy } from "lucide-react";
import { Link } from "@/i18n/navigation";
import CourtArt from "@/components/courts/CourtArt";
import { BADGE } from "@/lib/badges";
import { initials } from "@/lib/avatar";
import { SURFACES_BY_SPORT } from "@/lib/labels";
import type { Sport } from "@/types/database";

// The building blocks shared by the public pages of leagues, tournaments and
// Americano evenings, so the three look and work the same: a title band with
// facts, forest-green tabs, the list of who's in, and a card for the details.

/** The band at the top: picture, status, name, organiser, then the facts. */
export function EventHero({
  sport,
  sportLabel,
  status,
  name,
  club,
  logo,
  organizedBy,
  children,
}: {
  sport: Sport;
  sportLabel: string;
  status: { label: string; tone: string };
  name: string;
  club: { name: string; slug: string };
  logo: string | null;
  /** "Organized by" in the page's language. */
  organizedBy: string;
  /** The <Fact> cards. */
  children: ReactNode;
}) {
  return (
    <section className="border-b border-ink-100 bg-[#f4f6f2]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-8 lg:pt-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-3xl shadow-[0_18px_40px_-18px_rgba(17,28,10,0.45)] ring-1 ring-black/5 sm:size-36">
            <CourtArt court={{ sport, surface: SURFACES_BY_SPORT[sport][0] }} />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-[#111c0a]/80 py-1.5 text-[11px] font-semibold text-white">
              <Trophy size={12} className="text-[#a8d832]" aria-hidden="true" />
              {sportLabel}
            </span>
          </div>
          <div className="min-w-0">
            <span className={`${BADGE} ${status.tone}`}>{status.label}</span>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 text-balance sm:text-5xl">{name}</h1>
            <Link
              href={`/clubs/${club.slug}`}
              className="mt-3 inline-flex items-center gap-2.5 text-sm text-ink-600 hover:text-ink-900"
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="size-7 rounded-lg border border-ink-100 object-cover" />
              ) : (
                <span
                  className="grid size-7 place-items-center rounded-lg bg-brand-100 text-[11px] font-bold text-brand-900"
                  aria-hidden="true"
                >
                  {initials(club.name)}
                </span>
              )}
              <span>
                {organizedBy}{" "}
                <span className="font-semibold text-brand-800 underline-offset-2 hover:underline">{club.name}</span>
              </span>
            </Link>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3">{children}</div>
      </div>
    </section>
  );
}

/** One fact card under the title: icon, label, value and a smaller line. */
export function Fact({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f3fbde] text-[#4d7a08]" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
        <p className="mt-0.5 text-[15px] font-semibold text-ink-900 first-letter:uppercase">{value}</p>
        {sub && <p className="mt-0.5 text-[13px] text-ink-600">{sub}</p>}
      </div>
    </div>
  );
}

/** The page under the band: content with tabs, and the sign-up box beside it. */
export function EventBody({
  tabs,
  active,
  base,
  label,
  aside,
  children,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  /** The page's own path, e.g. /leagues/<id>. The first tab has no ?tab=. */
  base: string;
  label: string;
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 lg:py-10">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* Beside the content on computers, first on phones */}
        <aside className="md:order-last">
          <div className="md:sticky md:top-24">{aside}</div>
        </aside>
        <div className="min-w-0">
          {tabs.length > 1 && (
            <nav aria-label={label} className="-mx-6 mb-6 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:px-0">
              {tabs.map((tab, i) => (
                <Link
                  key={tab.key}
                  href={i === 0 ? base : `${base}?tab=${tab.key}`}
                  scroll={false}
                  aria-current={active === tab.key ? "page" : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    active === tab.key
                      ? "border-brand-900 bg-brand-900 text-white"
                      : "border-ink-100 bg-white text-ink-600 hover:border-ink-200"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          )}
          {children}
        </div>
      </div>
    </main>
  );
}

/** Picks the tab from ?tab=, or the first one. */
export const pickTab = <T extends string>(tabs: T[], asked: string | undefined): T =>
  tabs.includes(asked as T) ? (asked as T) : tabs[0];

/** A card with a heading and text: the event's details and how it works. */
export function AboutCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-ink-100 bg-white p-6">
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-ink-600">{children}</div>
    </section>
  );
}

/** Who's in: a card each, with initials, the name (and partner) and a number. */
export function EntryList({
  entries,
  empty,
}: {
  entries: { id: string; name: string; partner?: string | null; mine?: boolean }[];
  empty: string;
}) {
  if (!entries.length) {
    return (
      <p className="rounded-3xl border border-ink-100 bg-white px-6 py-12 text-center text-sm text-ink-600">{empty}</p>
    );
  }
  return (
    <ol className="grid gap-2.5 sm:grid-cols-2">
      {entries.map((e, i) => (
        <li
          key={e.id}
          className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 ${e.mine ? "border-brand-300" : "border-ink-100"}`}
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef1ea] text-[12px] font-bold text-ink-800"
            aria-hidden="true"
          >
            {initials(e.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ink-900">{e.name}</span>
            {e.partner && <span className="block truncate text-[13px] text-ink-600">{e.partner}</span>}
          </span>
          <span className="text-[13px] tabular-nums text-ink-400">#{i + 1}</span>
        </li>
      ))}
    </ol>
  );
}
