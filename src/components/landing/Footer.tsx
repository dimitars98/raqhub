import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function Footer() {
  const locale = await getLocale();
  const t = await getTranslations("footer");

  return (
    <footer className="bg-ink-900 text-white overflow-hidden">
      <div className="max-w-[1180px] mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-20">
          {/* Statement + main action */}
          <div className="max-w-sm">
            <p className="text-2xl font-semibold leading-snug tracking-tight">
              {t("statement")}
            </p>
            <Link
              href={`/${locale}/signup?role=admin`}
              className="mt-6 inline-flex h-12 items-center rounded-full bg-brand-400 px-6 text-sm font-semibold text-ink-900 transition-colors hover:bg-white"
            >
              {t("setUp")}
            </Link>
          </div>

          {/* Links */}
          <nav
            aria-label={t("navLabel")}
            className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-3 lg:gap-x-16"
          >
            {[
              {
                title: t("groups.product"),
                links: [
                  [t("links.features"), `/${locale}#features`],
                  [t("links.how"), `/${locale}#how`],
                  [t("links.pricing"), `/${locale}#pricing`],
                ],
              },
              {
                title: t("groups.account"),
                links: [
                  [t("links.signIn"), `/${locale}/login`],
                  [t("links.forClubs"), `/${locale}/signup?role=admin`],
                  [t("links.forPlayers"), `/${locale}/signup?role=player`],
                ],
              },
              {
                title: t("groups.legal"),
                links: [
                  [t("links.privacy"), `/${locale}/privacy`],
                  [t("links.terms"), `/${locale}/terms`],
                ],
              },
            ].map((group) => (
              <div key={group.title}>
                <div className="mb-4 text-sm font-semibold text-white">
                  {group.title}
                </div>
                <ul className="space-y-3">
                  {group.links.map(([label, href]) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="text-sm text-white/60 transition-colors hover:text-brand-400"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 border-t border-white/10 pt-6 text-sm text-white/40">
          © {new Date().getFullYear()} SpinSync. All rights reserved
        </div>

        {/* Oversized wordmark, cropped by the bottom edge */}
        {/* <div
          aria-hidden="true"
          className="mt-10 -mb-[0.14em] select-none whitespace-nowrap font-extrabold leading-[0.8] tracking-tighter text-brand-400 text-[length:min(15vw,190px)]"
        >
          Kortello
        </div> */}
      </div>
    </footer>
  );
}
