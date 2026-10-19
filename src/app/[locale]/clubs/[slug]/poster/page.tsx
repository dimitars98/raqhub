import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { clubLink, qrSvg } from "@/lib/share";
import PrintButton from "./PrintButton";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Poster · ${slug}`, robots: { index: false } };
}

/**
 * A one-page A4 poster for the club's wall: big QR code that opens the club's
 * booking page. Public, like the club page itself; the admin opens it from
 * "Share with your players" and prints it.
 */
export default async function ClubPosterPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: club } = await supabase
    .from("clubs")
    .select("name, slug, city")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!club) notFound();

  const locale = await getLocale();
  const t = await getTranslations("share.poster");
  const link = clubLink(locale, club.slug);
  const qr = await qrSvg(link);

  return (
    <main className="min-h-screen bg-ink-50 py-8 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 0; }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <PrintButton label={t("print")} />
      </div>

      <article className="mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col items-center justify-between bg-white px-[18mm] py-[20mm] text-center shadow-sm print:shadow-none">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
            {club.name}
            {club.city ? ` · ${club.city}` : ""}
          </p>
          <h1 className="font-display mt-6 text-[44px] font-extrabold leading-[1.05] tracking-tight text-ink-900">
            {t("title")}
          </h1>
          <p className="mx-auto mt-5 max-w-[140mm] text-lg text-ink-600">{t("body")}</p>
        </header>

        <div
          className="my-10 w-[110mm] max-w-full [&>svg]:h-auto [&>svg]:w-full"
          role="img"
          aria-label={t("qrAlt")}
          dangerouslySetInnerHTML={{ __html: qr }}
        />

        <footer className="w-full">
          <ol className="mx-auto mb-8 grid max-w-[160mm] grid-cols-3 gap-4 text-sm text-ink-800">
            {(["step1", "step2", "step3"] as const).map((step, i) => (
              <li key={step} className="flex flex-col items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-brand-100 font-bold text-brand-900">
                  {i + 1}
                </span>
                {t(step)}
              </li>
            ))}
          </ol>
          <p className="text-xs text-ink-400">{t("orVisit")}</p>
          <p className="mt-1 break-all font-mono text-sm text-ink-800">{link}</p>
          <p className="mt-6 text-xs text-ink-400">Kortello</p>
        </footer>
      </article>
    </main>
  );
}
