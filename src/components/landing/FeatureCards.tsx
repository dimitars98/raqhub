import { useTranslations } from "next-intl";
import { BarChart3, Bell, Calendar, CreditCard, Globe, Link2, QrCode, Trophy } from "lucide-react";

export default function FeatureCards() {
  const t = useTranslations("featureCards");
  return (
    <section className="max-w-[1180px] mx-auto px-6 py-16 lg:px-10 lg:py-24">
      <div className="text-center mb-10 lg:mb-14">
        <div className="text-[11px] font-semibold text-[#7aad12] uppercase tracking-widest mb-3">
          {t("label")}
        </div>
        <h2 className="font-display text-[28px] sm:text-[34px] lg:text-[40px] font-extrabold text-[#111c0a] tracking-tight leading-[1.1] mb-4">
          {t("title1")} <br className="hidden sm:block" />
          {t("title2")}
        </h2>
        <p className="text-[15px] text-[#6e7f65] font-light max-w-[440px] mx-auto">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Large card — spans 2 cols */}
        <div className="md:col-span-2 bg-[#111c0a] rounded-2xl p-6 sm:p-8 flex flex-col gap-8 sm:flex-row sm:items-center">
          <div className="sm:flex-1">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-5">
              <Calendar size={18} className="text-[#a8d832]" />
            </div>
            <h3 className="font-display text-[22px] font-extrabold text-white tracking-tight mb-2">
              {t("scheduling.title")}
            </h3>
            <p className="text-[14px] text-white/50 font-light leading-relaxed max-w-[280px]">
              {t("scheduling.body")}
            </p>
          </div>
          {/* Mini schedule visual */}
          <div className="w-full sm:w-[200px] sm:flex-shrink-0 bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">
              {t("scheduling.today")}
            </div>
            {[
              { time: "09:00", label: "Ana M.", color: "#a8d832" },
              {
                time: "10:30",
                label: t("scheduling.available"),
                color: "transparent",
                border: true,
              },
              { time: "12:00", label: "Marko K.", color: "#a8d832" },
              {
                time: "13:30",
                label: t("scheduling.blocked"),
                color: "white",
                opacity: true,
              },
              {
                time: "15:00",
                label: t("scheduling.available"),
                color: "transparent",
                border: true,
              },
            ].map(({ time, label, color, border, opacity }) => (
              <div key={time} className="flex items-center gap-2.5 mb-2">
                <span className="text-[10px] text-white/30 w-9 flex-shrink-0">
                  {time}
                </span>
                <div
                  className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium ${
                    border
                      ? "border border-white/15 text-white/30"
                      : opacity
                        ? "bg-white/10 text-white/25"
                        : "text-[#111c0a]"
                  }`}
                  style={
                    !border && !opacity ? { background: color } : undefined
                  }
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications card */}
        <div className="bg-[#f8f9f7] border border-[#e8ede4] rounded-2xl p-6 sm:p-7">
          <div className="w-10 h-10 rounded-xl bg-[#f3fbde] border border-[#d6f09a] flex items-center justify-center mb-5">
            <Bell size={18} className="text-[#7aad12]" />
          </div>
          <h3 className="font-display text-[18px] font-extrabold text-[#111c0a] tracking-tight mb-2">
            {t("reminders.title")}
          </h3>
          <p className="text-[14px] text-[#6e7f65] font-light leading-relaxed mb-5">
            {t("reminders.body")}
          </p>
          <div className="space-y-2">
            {[
              { title: t("reminders.confirmed"), msg: t("reminders.lesson"), delta: t("reminders.instant") },
              { title: t("reminders.sent"), msg: t("reminders.court"), delta: t("reminders.before24") },
            ].map(({ title, msg, delta }) => (
              <div
                key={msg}
                className="bg-white border border-[#e8ede4] rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[#111c0a]">
                    {title}
                  </div>
                  <div className="text-[10px] text-[#6e7f65]">{msg}</div>
                </div>
                <span className="text-[9px] font-medium bg-[#f3fbde] text-[#7aad12] px-2 py-0.5 rounded-md whitespace-nowrap">
                  {delta}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payments card */}
        <div className="bg-[#f8f9f7] border border-[#e8ede4] rounded-2xl p-6 sm:p-7">
          <div className="w-10 h-10 rounded-xl bg-[#f3fbde] border border-[#d6f09a] flex items-center justify-center mb-5">
            <CreditCard size={18} className="text-[#7aad12]" />
          </div>
          <h3 className="font-display text-[18px] font-extrabold text-[#111c0a] tracking-tight mb-2">
            {t("payments.title")}
          </h3>
          <p className="text-[14px] text-[#6e7f65] font-light leading-relaxed mb-5">
            {t("payments.body")}
          </p>
          <div className="flex items-end gap-1.5 h-14">
            {[40, 55, 48, 70, 62, 85, 78].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${h}%`,
                  background: i === 6 ? "#7aad12" : "#e8ede4",
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-[#6e7f65]">
            <span>{t("payments.last7")}</span>
            <span className="font-semibold text-[#7aad12]">↑ €1,240</span>
          </div>
        </div>

        {/* Utilisation card — fills the rest of its row on tablet and desktop */}
        <div className="md:col-span-2 bg-[#f8f9f7] border border-[#e8ede4] rounded-2xl p-6 sm:p-7">
          <div className="w-10 h-10 rounded-xl bg-[#f3fbde] border border-[#d6f09a] flex items-center justify-center mb-5">
            <BarChart3 size={18} className="text-[#7aad12]" />
          </div>
          <h3 className="font-display text-[18px] font-extrabold text-[#111c0a] tracking-tight mb-2">
            {t("utilisation.title")}
          </h3>
          <p className="text-[14px] text-[#6e7f65] font-light leading-relaxed mb-5">
            {t("utilisation.body")}
          </p>
          <div className="space-y-2">
            {[
              { name: t("utilisation.c1"), pct: 91 },
              { name: t("utilisation.c2"), pct: 74 },
              { name: t("utilisation.c3"), pct: 55 },
            ].map(({ name, pct }) => (
              <div key={name}>
                <div className="flex justify-between text-[10px] text-[#6e7f65] mb-1">
                  <span>{name}</span>
                  <span className="font-semibold text-[#111c0a]">{pct}%</span>
                </div>
                <div className="h-1.5 bg-[#e8ede4] rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background:
                        pct >= 80
                          ? "#7aad12"
                          : pct >= 60
                            ? "#a8d832"
                            : "#d6f09a",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Club page card — spans full width */}
        <div className="md:col-span-2 lg:col-span-3 bg-white border border-[#e8ede4] rounded-2xl p-6 sm:p-8 flex flex-col gap-8 lg:flex-row lg:gap-16 lg:items-center">
          <div className="lg:flex-1 lg:max-w-[380px]">
            <div className="w-10 h-10 rounded-xl bg-[#f3fbde] border border-[#d6f09a] flex items-center justify-center mb-5">
              <Link2 size={18} className="text-[#7aad12]" />
            </div>
            <h3 className="font-display text-[22px] font-extrabold text-[#111c0a] tracking-tight mb-2">
              {t("page.title")}
            </h3>
            <p className="text-[14px] text-[#6e7f65] font-light leading-relaxed">
              {t("page.body")}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex-1">
            {[
              { icon: Link2, title: t("page.link"), sub: t("page.linkSub") },
              { icon: QrCode, title: t("page.poster"), sub: t("page.posterSub") },
              { icon: Globe, title: t("page.languages"), sub: t("page.languagesSub") },
              { icon: Trophy, title: t("page.tournaments"), sub: t("page.tournamentsSub") },
            ].map(({ icon: Icon, title, sub }) => (
              <div
                key={title}
                className="flex items-center gap-3 bg-[#f8f9f7] border border-[#e8ede4] rounded-xl px-3 py-2.5"
              >
                <div className="w-8 h-8 rounded-full bg-[#f3fbde] flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-[#7aad12]" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111c0a] truncate">{title}</div>
                  <div className="text-[10px] text-[#6e7f65] truncate">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
