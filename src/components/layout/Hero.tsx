import Image from "next/image";
import { CalendarCheck, Globe, Percent, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Hero() {
  const t = useTranslations("hero");
  // Facts about the product, not made-up usage numbers.
  const stats = [
    { value: "30", suffix: t("stats.daysSuffix"), label: t("stats.trial"), icon: CalendarCheck },
    { value: "0", suffix: "%", label: t("stats.commission"), icon: Percent },
    { value: "3", suffix: "", label: t("stats.sports"), icon: Trophy },
    { value: "6", suffix: "", label: t("stats.languages"), icon: Globe },
  ];
  return (
    // <section className="bg-[linear-gradient(165deg,white_50%,var(--color-brand-600)_20%)]">
    // <section className="bg-[url('/layered-steps-haikei2.svg')] bg-cover bg-center bg-no-repeat">
    <section
      className="
    "
    >
      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-20 lg:pb-30">
        <div className="flex flex-col-reverse gap-10 lg:flex-row lg:items-center lg:gap-16">
          {/* Left: image stack (single image on mobile, collage on desktop) */}
          <div className="relative w-full lg:w-1/2 lg:h-[520px] lg:shrink-0">
            <Image
              src="https://images.unsplash.com/photo-1627314387807-df615e8567de?q=80&w=1548&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt=""
              width={460}
              height={340}
              priority
              className="w-full rounded-2xl object-cover lg:absolute lg:top-0 lg:left-0 lg:w-[460px]"
              sizes="(max-width: 1024px) 100vw, 460px"
            />
            <Image
              src="https://images.unsplash.com/photo-1646649851780-d9701b7c3c04?q=80&w=1742&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt=""
              width={380}
              height={280}
              className="hidden lg:block absolute bottom-0 left-50 rounded-2xl border-8 border-white object-cover"
              sizes="380px"
            />
            <Image
              src="https://images.unsplash.com/photo-1693142518277-3568e9ec3176?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt=""
              width={380}
              height={280}
              className="hidden lg:block absolute -bottom-[150px] -left-[50px] rounded-2xl border-8 border-white object-cover"
              sizes="380px"
            />
          </div>

          {/* Right: text */}
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl text-brand-400 font-extrabold leading-tight">
              {t("title1")}
              <br />
              {t("title2")}
            </h1>
            <p className="text-lg text-gray-500 max-w-md">
              {t("subtitle")}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/signup?role=admin" className="btn-primary py-5 px-7">
                {t("getStarted")}
              </Link>
              <a href="#how" className="btn-secondary py-5 px-7">
                {t("seeHow")}
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-10 px-6 pb-12 lg:pb-0 flex justify-center">
        <div className="w-full max-w-[1180px] lg:translate-y-1/2">
          <div className="grid grid-cols-2 lg:grid-cols-4 rounded-3xl border border-[#e8ede4] bg-white shadow-[0_1px_2px_rgba(17,28,10,0.04),0_16px_48px_-12px_rgba(17,28,10,0.14)]">
            {stats.map(({ value, suffix, label, icon: Icon }, i) => (
              <div
                key={label}
                className={`group relative flex flex-col items-start gap-3 border-[#e8ede4] px-5 py-6 sm:flex-row sm:items-center sm:gap-4 sm:px-7 sm:py-7 ${
                  i % 2 === 1 ? "border-l lg:border-l-0" : ""
                } ${i >= 2 ? "border-t lg:border-t-0" : ""}`}
              >
                {/* Short inset divider on desktop */}
                {i > 0 && (
                  <span className="absolute left-0 top-1/2 hidden h-10 w-px -translate-y-1/2 bg-[#e8ede4] lg:block" />
                )}

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d6f09a] bg-[#f3fbde] text-[#7aad12] transition-colors duration-200 group-hover:border-[#7aad12] group-hover:bg-[#7aad12] group-hover:text-white">
                  <Icon size={20} aria-hidden="true" />
                </div>

                <div>
                  <div className="font-display text-[32px] font-extrabold leading-none tracking-[-1.5px] text-[#111c0a]">
                    {value}
                    <span
                      className={`text-[#7aad12] ${
                        suffix.length > 1
                          ? "ml-1 text-[18px] font-bold tracking-normal"
                          : ""
                      }`}
                    >
                      {suffix}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[13px] text-[#6e7f65]">
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
