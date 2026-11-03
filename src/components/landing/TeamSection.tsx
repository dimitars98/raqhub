import { useTranslations } from "next-intl";
import Image from "next/image";
import CourtBackdrop from "./CourtBackdrop";

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

export default function TeamSection() {
  const t = useTranslations("sports");
  return (
    <section className="relative overflow-hidden bg-[#111c0a] py-16 lg:flex lg:min-h-[1200px] lg:items-center lg:py-24">
      {/* Our own drawing (court lines, a ball in flight) instead of a stock photo */}
      <CourtBackdrop />

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
              <p className="text-gray-500 text-sm max-w-xs">
                {t(`${sports[1].id}.description`)}
              </p>
            </div>
          </div>

          {/* Intro + card — first on mobile/tablet, middle column on desktop */}
          <div className="order-1 lg:order-2 flex flex-col gap-6">
            <h2 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-tight text-white sm:text-[44px]">
              {t("eyebrow")}
            </h2>
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
                <p className="text-gray-200 text-sm max-w-xs">
                  {t(`${sports[0].id}.description`)}
                </p>
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
                  <p className="text-gray-200 text-sm max-w-xs">
                    {t(`${sport.id}.description`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
