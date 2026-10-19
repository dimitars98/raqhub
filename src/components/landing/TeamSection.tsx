import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

const sports = [
  {
    id: "padel",
    image:
      "https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c?auto=format&fit=crop&w=800&q=70",
  },
  {
    id: "tennis",
    image:
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=800&q=70",
  },
  {
    id: "pickleball",
    image:
      "https://images.unsplash.com/photo-1659318006095-4d44845f3a1b?auto=format&fit=crop&w=800&q=70",
  },
  {
    id: "coaching",
    image:
      "https://images.unsplash.com/photo-1634840542403-1a9b1067aaa0?auto=format&fit=crop&w=800&q=70",
  },
];

/**
 * ServeButton — a pill with a tennis ball on the end.
 * On hover the arrow is "served" out of the ball and a new one lands,
 * while the pill floods with brand lime and the ball turns ink.
 *
 * tone="dark"  → glass pill, for use over photos
 * tone="light" → ink pill, for use on white surfaces
 *
 * It takes the visitor to the features further down the page.
 */
function ServeButton({
  tone = "dark",
  children,
}: {
  tone?: "dark" | "light";
  children: ReactNode;
}) {
  const surface =
    tone === "dark"
      ? "border-white/30 bg-white/10 text-white backdrop-blur-md"
      : "border-[#111c0a] bg-[#111c0a] text-white";

  return (
    <a
      href="#features"
      className={`group/btn inline-flex w-fit items-center gap-3 rounded-full border py-1.5 pl-5 pr-1.5 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-300 ease-out hover:border-[#a8d832] hover:bg-[#a8d832] hover:text-[#111c0a] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8d832] motion-reduce:transition-none ${surface}`}
    >
      {children}

      {/* The ball. before/after draw the two seams and inherit the arrow colour. */}
      <span
        aria-hidden
        className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#a8d832] text-[#111c0a] transition-colors duration-300 ease-out before:absolute before:inset-y-0 before:-left-[64%] before:w-full before:rounded-full before:border-[1.5px] before:border-current before:opacity-20 after:absolute after:inset-y-0 after:-right-[64%] after:w-full after:rounded-full after:border-[1.5px] after:border-current after:opacity-20 group-hover/btn:bg-[#111c0a] group-hover/btn:text-[#a8d832] motion-reduce:transition-none"
      >
        {/* Arrow that gets served out */}
        <ArrowUpRight
          size={16}
          strokeWidth={2.5}
          className="relative z-10 transition-transform duration-300 ease-out group-hover/btn:translate-x-[160%] group-hover/btn:-translate-y-[160%] motion-reduce:transition-none"
        />
        {/* Arrow that lands in its place */}
        <ArrowUpRight
          size={16}
          strokeWidth={2.5}
          className="absolute z-10 -translate-x-[160%] translate-y-[160%] transition-transform duration-300 ease-out group-hover/btn:translate-x-0 group-hover/btn:translate-y-0 motion-reduce:transition-none"
        />
      </span>
    </a>
  );
}

export default function TeamSection() {
  const t = useTranslations("sports");
  return (
    <section className="relative py-16 lg:flex lg:min-h-[1200px] lg:items-center lg:py-24">
      <Image
        src="https://images.unsplash.com/photo-1520641147456-f78b3e1d83b6?q=80&w=1748&auto=format&fit=crop"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 w-full px-6 lg:px-10">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Tall card — second on mobile/tablet, first column on desktop */}
          <div className="order-2 lg:order-1 relative group overflow-hidden rounded-[2.5rem] bg-[#1e3010] min-h-[460px] lg:min-h-[600px]">
            {/* Image */}
            <Image
              src={sports[1].image}
              alt={t(`${sports[1].id}.title`)}
              loading="lazy"
              decoding="async"
              width={500}
              height={600}
              className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-105"
            />

            {/* White card floating inside the bottom — radius = card radius (2.5rem) minus the 0.75rem inset */}
            <div className="absolute inset-x-3 bottom-3 z-10 bg-white rounded-[1.75rem] p-5 shadow-lg shadow-black/10">
              <h3 className="text-[#111c0a] text-xl font-semibold mb-1">
                {t(`${sports[1].id}.title`)}
              </h3>
              <p className="text-gray-500 text-sm mb-4 max-w-xs">
                {t(`${sports[1].id}.description`)}
              </p>
              <ServeButton tone="light">{t("learnMore")}</ServeButton>
            </div>
          </div>

          {/* Intro + card — first on mobile/tablet, middle column on desktop */}
          <div className="order-1 lg:order-2 flex flex-col gap-6">
            <span className="inline-block text-cyan-400 font-handwriting text-3xl sm:text-4xl font-bold w-fit">
              {t("eyebrow")}
            </span>
            <p className="text-gray-200 text-base sm:text-lg leading-relaxed">
              {t("intro")}
            </p>

            <div className="relative group overflow-hidden rounded-[2.5rem] bg-[#1e3010] mt-auto h-[360px] sm:h-[400px]">
              <Image
                src={sports[0].image}
                alt={t(`${sports[0].id}.title`)}
                loading="lazy"
                decoding="async"
                width={500}
                height={400}
                className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 sm:p-8 flex flex-col justify-end">
                <h3 className="text-white text-3xl lg:text-4xl font-semibold mb-2">
                  {t(`${sports[0].id}.title`)}
                </h3>
                <p className="text-gray-200 text-sm mb-6 max-w-xs">
                  {t(`${sports[0].id}.description`)}
                </p>
                <ServeButton>{t("learnMore")}</ServeButton>
              </div>
            </div>
          </div>

          {/* Two cards — stacked on mobile, side by side on tablet, stacked column on desktop */}
          <div className="order-3 md:col-span-2 lg:col-span-1 flex flex-col md:flex-row lg:flex-col gap-6">
            {sports.slice(2).map((sport) => (
              <div
                key={sport.id}
                className="relative group overflow-hidden rounded-[2.5rem] bg-[#1e3010] flex-1 min-h-[320px]"
              >
                <Image
                  src={sport.image}
                  alt={t(`${sport.id}.title`)}
                  loading="lazy"
                  decoding="async"
                  width={500}
                  height={320}
                  className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 sm:p-8 flex flex-col justify-end">
                  <h3 className="text-white text-3xl font-semibold mb-2">
                    {t(`${sport.id}.title`)}
                  </h3>
                  <p className="text-gray-200 text-sm mb-6 max-w-xs">
                    {t(`${sport.id}.description`)}
                  </p>
                  <ServeButton>{t("learnMore")}</ServeButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
