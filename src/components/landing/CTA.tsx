import { getLocale } from "next-intl/server";
import Link from "next/link";

export default async function CTA() {
  const locale = await getLocale();
  return (
    <section className="max-w-[1180px] mx-auto px-6 py-16 lg:px-10 lg:py-24">
      <div className="bg-[#111c0a] rounded-2xl px-6 py-12 sm:px-10 lg:px-16 lg:py-[72px] grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 items-center">
        <div>
          <h2 className="font-display text-[28px] sm:text-[34px] lg:text-[40px] font-extrabold text-white tracking-tight leading-[1.1] mb-4">
            Your courts deserve
            <br />
            better software.
          </h2>
          <p className="text-[16px] text-white/50 font-light leading-relaxed">
            Join 500+ clubs already using ServeTime.{" "}
            <br className="hidden sm:block" />
            No credit card required to start.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <Link
            href={`/${locale}/signup?role=admin`}
            className="bg-white text-[#111c0a] font-medium text-[15px] text-center px-7 py-3.5 rounded-lg hover:bg-[#f3fbde] transition-colors lg:whitespace-nowrap"
          >
            Start free — no card needed
          </Link>
          <Link
            href={`/${locale}/signup?role=player`}
            className="text-white/50 text-[14px] text-center lg:text-right hover:text-white transition-colors"
          >
            I&apos;m a player →
          </Link>
        </div>
      </div>
    </section>
  );
}
