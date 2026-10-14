import { useTranslations } from "next-intl";

export default function HowItWorks() {
  const t = useTranslations("howItWorks");
  return (
    <section
      id="how"
      className="bg-[#f8f9f7] border-y border-[#e8ede4] py-16 px-6 lg:py-24 lg:px-10"
    >
      <div className="max-w-[1180px] mx-auto">
        <div className="text-center mb-10 lg:mb-14">
          <div className="text-[11px] font-semibold text-[#7aad12] uppercase tracking-widest mb-3">
            {t("label")}
          </div>
          <h2 className="font-display text-[28px] sm:text-[34px] lg:text-[40px] font-extrabold text-[#111c0a] tracking-tight leading-[1.1] mb-4">
            {t("title")}
          </h2>
          <p className="text-[15px] text-[#6e7f65] font-light max-w-[440px] mx-auto">
            {t("subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-8">
          {[
            [
              "01",
              t("steps.create.title"),
              t("steps.create.body"),
              "https://images.unsplash.com/photo-1635873021329-c0af04695c9d?q=80&w=872&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            ],
            [
              "02",
              t("steps.invite.title"),
              t("steps.invite.body"),
              "https://images.unsplash.com/photo-1737477009005-803c7c64897c?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            ],
            [
              "03",
              t("steps.run.title"),
              t("steps.run.body"),
              "https://images.unsplash.com/photo-1595435742656-5272d0b3fa82?q=80&w=870&auto=format&fit=crop",
            ],
          ].map(([num, title, desc, img]) => (
            <div
              key={num}
              className="relative border border-[#e8ede4] rounded-2xl p-6 sm:p-8 overflow-hidden min-h-[280px] flex flex-col justify-end"
              style={
                img
                  ? {
                      backgroundImage: `url(${img})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : { backgroundColor: "white" }
              }
            >
              {/* dark gradient overlay so text stays readable */}
              {img && (
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/80" />
              )}
              <div className="relative z-10">
                {/* <div
                  className={`font-display text-[48px] font-extrabold opacity-50 leading-none mb-5 ${img ? "text-white" : "text-[#7aad12]"}`}
                >
                  {num}
                </div> */}
                <h3
                  className={`font-display text-[18px] font-bold mb-2 ${img ? "text-white" : "text-[#111c0a]"}`}
                >
                  {title}
                </h3>
                <p
                  className={`text-[14px] leading-relaxed font-light ${img ? "text-white/80" : "text-[#6e7f65]"}`}
                >
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
