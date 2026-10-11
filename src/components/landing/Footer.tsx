import { getLocale } from "next-intl/server";
import Link from "next/link";

export default async function Footer() {
  const locale = await getLocale();

  return (
    <footer className="bg-ink-900 text-white overflow-hidden">
      <div className="max-w-[1180px] mx-auto px-6 lg:px-10 pt-16 lg:pt-20">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-20">
          {/* Statement + main action */}
          <div className="max-w-sm">
            <p className="text-2xl font-semibold leading-snug tracking-tight">
              Booking software for tennis, padel and pickleball clubs.
            </p>
            <Link
              href={`/${locale}/signup?role=admin`}
              className="mt-6 inline-flex h-12 items-center rounded-full bg-brand-400 px-6 text-sm font-semibold text-ink-900 transition-colors hover:bg-white"
            >
              Set up your club
            </Link>
          </div>

          {/* Links */}
          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-3 lg:gap-x-16"
          >
            {[
              {
                title: "Product",
                links: [
                  ["Features", `/${locale}#features`],
                  ["How it works", `/${locale}#how`],
                  ["Pricing", `/${locale}#pricing`],
                ],
              },
              {
                title: "Account",
                links: [
                  ["Sign in", `/${locale}/login`],
                  ["For clubs", `/${locale}/signup?role=admin`],
                  ["For players", `/${locale}/signup?role=player`],
                ],
              },
              {
                title: "Legal",
                links: [
                  ["Privacy policy", `/${locale}/privacy`],
                  ["Terms of service", `/${locale}/terms`],
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
          © {new Date().getFullYear()} ServeTime
        </div>

        {/* Oversized wordmark, cropped by the bottom edge */}
        <div
          aria-hidden="true"
          className="mt-10 -mb-[0.14em] select-none whitespace-nowrap font-extrabold leading-[0.8] tracking-tighter text-brand-400 text-[length:min(15vw,190px)]"
        >
          ServeTime
        </div>
      </div>
    </footer>
  );
}
