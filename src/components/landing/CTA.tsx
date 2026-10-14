import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function CTA() {
  const locale = await getLocale();
  const t = await getTranslations("cta");
  return (
    <section className="max-w-[1180px] mx-auto px-6 py-16 lg:px-10 lg:py-24">
      <div className="bg-[#111c0a] rounded-2xl px-6 py-12 sm:px-10 lg:px-16 lg:py-[72px] grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 items-center">
        <div>
          <h2 className="font-display text-[28px] sm:text-[34px] lg:text-[40px] font-extrabold text-white tracking-tight leading-[1.1] mb-4">
            {t("title1")}
            <br />
            {t("title2")}
          </h2>
          <p className="text-[16px] text-white/50 font-light leading-relaxed">
            {t("trial")}{" "}
            <br className="hidden sm:block" />
            {t("noCard")}
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <Link
            href={`/${locale}/signup?role=admin`}
            className="bg-white text-[#111c0a] font-medium text-[15px] text-center px-7 py-3.5 rounded-lg hover:bg-[#f3fbde] transition-colors lg:whitespace-nowrap"
          >
            {t("start")}
          </Link>
          <Link
            href={`/${locale}/signup?role=player`}
            className="text-white/50 text-[14px] text-center lg:text-right hover:text-white transition-colors"
          >
            {t("player")}
          </Link>
        </div>
      </div>
    </section>
  );
}
