import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/landing/Footer";
import { Link } from "@/i18n/navigation";
import { LEGAL } from "@/lib/legal";
import { TRIAL_DAYS } from "@/lib/plans";

// A section's body is a list of blocks: a string is a paragraph, an array
// of strings is a bullet list. Text may use <b>…</b> and the {email} and
// {trialDays} placeholders.
type Block = string | string[];
type Section = { title: string; body: Block[] };
export type LegalKind = "privacy" | "terms";

const OTHER: Record<LegalKind, LegalKind> = { privacy: "terms", terms: "privacy" };

function rich(text: string): ReactNode[] {
  const filled = text.replaceAll("{trialDays}", String(TRIAL_DAYS));
  return filled.split(/(<b>.*?<\/b>|\{email\})/g).map((part, i) => {
    if (part === "{email}") {
      return (
        <a
          key={i}
          href={`mailto:${LEGAL.email}`}
          className="font-medium text-ink-900 underline decoration-brand-400 decoration-2 underline-offset-2 hover:decoration-ink-900"
        >
          {LEGAL.email}
        </a>
      );
    }
    const bold = part.match(/^<b>(.*)<\/b>$/);
    if (bold) {
      return (
        <strong key={i} className="font-semibold text-ink-900">
          {bold[1]}
        </strong>
      );
    }
    return part;
  });
}

export async function legalTitle(kind: LegalKind) {
  const t = await getTranslations(`legal.${kind}`);
  return `${t("title")} · ServeTime`;
}

export default async function LegalPage({ kind }: { kind: LegalKind }) {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const sections = t.raw(`${kind}.sections`) as Section[];
  // "14 October 2026", "14. Oktober 2026", "14 октомври 2026 г." …
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(`${LEGAL.updated}T12:00:00`),
  );
  const other = OTHER[kind];

  return (
    <>
      <Navbar />
      <main className="bg-white">
        <div className="mx-auto max-w-3xl px-6 py-14 lg:py-20">
          <header className="border-b border-ink-100 pb-10">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
              {t("label")}
            </p>
            {/* lang lets the browser hyphenate long words like "Datenschutzerklärung" on phones */}
            <h1
              lang={locale}
              className="mt-3 hyphens-auto text-[1.75rem] font-bold leading-tight tracking-tight text-ink-900 [overflow-wrap:anywhere] sm:text-5xl"
            >
              {t(`${kind}.title`)}
            </h1>
            <p className="mt-4 text-sm text-ink-400">{t("updated", { date: updated })}</p>
            <p className="mt-6 text-lg leading-relaxed text-ink-600">
              {rich(t.raw(`${kind}.intro`) as string)}
            </p>
          </header>

          {/* Contents */}
          <nav aria-label={t("contents")} className="mt-10 rounded-3xl bg-ink-50 p-6 sm:p-8">
            <p className="text-sm font-semibold text-ink-900">{t("contents")}</p>
            <ol className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {sections.map((s, i) => (
                <li key={i}>
                  <a
                    href={`#section-${i + 1}`}
                    className="text-ink-600 transition-colors hover:text-ink-900"
                  >
                    <span className="mr-2 tabular-nums text-ink-400">{i + 1}.</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-12 space-y-12">
            {sections.map((s, i) => (
              <section key={i} id={`section-${i + 1}`} className="scroll-mt-28">
                <h2 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
                  <span className="mr-2 tabular-nums text-brand-600">{i + 1}.</span>
                  {s.title}
                </h2>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-ink-600">
                  {s.body.map((block, j) =>
                    Array.isArray(block) ? (
                      <ul key={j} className="space-y-2.5 pl-1">
                        {block.map((item, k) => (
                          <li key={k} className="flex gap-3">
                            <span
                              aria-hidden="true"
                              className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400"
                            />
                            <span>{rich(item)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p key={j}>{rich(block)}</p>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>

          {/* Who to contact */}
          <div className="mt-14 rounded-3xl border border-ink-100 p-6 sm:p-8">
            <p className="text-sm font-semibold text-ink-900">{t("contactTitle")}</p>
            <p className="mt-2 text-base leading-relaxed text-ink-600">
              {rich(t.raw(`${kind}.contact`) as string)}
            </p>
            {(LEGAL.operator || LEGAL.address) && (
              <div className="mt-4 space-y-1 text-base text-ink-600">
                {LEGAL.operator && <p className="font-medium text-ink-900">{LEGAL.operator}</p>}
                {LEGAL.address && <p>{LEGAL.address}</p>}
              </div>
            )}
          </div>

          <p className="mt-10 text-base text-ink-600">
            <Link
              href={`/${other}`}
              className="font-semibold text-ink-900 underline decoration-brand-400 decoration-2 underline-offset-4 hover:decoration-ink-900"
            >
              {t(`${other}.title`)} →
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
