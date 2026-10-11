import { BarChart3, Bell, Calendar, CreditCard, Users } from "lucide-react";

export default function FeatureCards() {
  return (
    <section className="max-w-[1180px] mx-auto px-6 py-16 lg:px-10 lg:py-24">
      <div className="text-center mb-10 lg:mb-14">
        <div className="text-[11px] font-semibold text-[#7aad12] uppercase tracking-widest mb-3">
          Built for every role
        </div>
        <h2 className="font-display text-[28px] sm:text-[34px] lg:text-[40px] font-extrabold text-[#111c0a] tracking-tight leading-[1.1] mb-4">
          Everything your club needs, <br className="hidden sm:block" />
          nothing it doesn&apos;t
        </h2>
        <p className="text-[15px] text-[#6e7f65] font-light max-w-[440px] mx-auto">
          A tightly focused set of tools that actually work together — not a
          bloated suite nobody uses.
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
              Smart scheduling, zero conflicts
            </h3>
            <p className="text-[14px] text-white/50 font-light leading-relaxed max-w-[280px]">
              Automatic conflict detection, buffer times, blackout dates and
              rolling availability windows — the calendar runs itself.
            </p>
          </div>
          {/* Mini schedule visual */}
          <div className="w-full sm:w-[200px] sm:flex-shrink-0 bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">
              Today
            </div>
            {[
              { time: "09:00", label: "Ana M.", color: "#a8d832" },
              {
                time: "10:30",
                label: "Available",
                color: "transparent",
                border: true,
              },
              { time: "12:00", label: "Marko K.", color: "#a8d832" },
              {
                time: "13:30",
                label: "Blocked",
                color: "white",
                opacity: true,
              },
              {
                time: "15:00",
                label: "Available",
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
            Automated reminders
          </h3>
          <p className="text-[14px] text-[#6e7f65] font-light leading-relaxed mb-5">
            SMS and email reminders go out automatically before every booking.
            Reduce no-shows without lifting a finger.
          </p>
          <div className="space-y-2">
            {[
              { msg: "Court 3 · tomorrow 10:00", delta: "24h before" },
              { msg: "Lesson with Sara F. · today", delta: "2h before" },
            ].map(({ msg, delta }) => (
              <div
                key={msg}
                className="bg-white border border-[#e8ede4] rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[#111c0a]">
                    Reminder sent
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
            Payments built in
          </h3>
          <p className="text-[14px] text-[#6e7f65] font-light leading-relaxed mb-5">
            Stripe-powered checkout for bookings, membership plans, and coaching
            sessions. Payouts land directly in your account.
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
            <span>Last 7 days</span>
            <span className="font-semibold text-[#7aad12]">↑ €1,240</span>
          </div>
        </div>

        {/* Utilisation card — full width on tablet so it isn't left alone in a row */}
        <div className="md:col-span-2 lg:col-span-1 bg-[#f8f9f7] border border-[#e8ede4] rounded-2xl p-6 sm:p-7">
          <div className="w-10 h-10 rounded-xl bg-[#f3fbde] border border-[#d6f09a] flex items-center justify-center mb-5">
            <BarChart3 size={18} className="text-[#7aad12]" />
          </div>
          <h3 className="font-display text-[18px] font-extrabold text-[#111c0a] tracking-tight mb-2">
            Court utilisation at a glance
          </h3>
          <p className="text-[14px] text-[#6e7f65] font-light leading-relaxed mb-5">
            See which courts are filling up and which are sitting empty. Make
            pricing decisions with real data.
          </p>
          <div className="space-y-2">
            {[
              { name: "Court 1 — Clay", pct: 91 },
              { name: "Court 2 — Hard", pct: 74 },
              { name: "Court 3 — Indoor", pct: 55 },
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

        {/* Members / multi-admin card — spans full width */}
        <div className="md:col-span-2 lg:col-span-3 bg-white border border-[#e8ede4] rounded-2xl p-6 sm:p-8 flex flex-col gap-8 lg:flex-row lg:gap-16 lg:items-center">
          <div className="lg:flex-1 lg:max-w-[380px]">
            <div className="w-10 h-10 rounded-xl bg-[#f3fbde] border border-[#d6f09a] flex items-center justify-center mb-5">
              <Users size={18} className="text-[#7aad12]" />
            </div>
            <h3 className="font-display text-[22px] font-extrabold text-[#111c0a] tracking-tight mb-2">
              Your whole team, one dashboard
            </h3>
            <p className="text-[14px] text-[#6e7f65] font-light leading-relaxed">
              Invite multiple admins and coaches. Set role-based permissions so
              everyone sees exactly what they need — and nothing they
              don&apos;t.
            </p>
          </div>
          {/* Role pills */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex-1">
            {[
              {
                init: "TK",
                bg: "#3a7020",
                name: "Tomislav K.",
                role: "Head admin",
                badge: "Full access",
                bc: "#f3fbde",
                tc: "#7aad12",
              },
              {
                init: "SF",
                bg: "#7aad12",
                name: "Sara F.",
                role: "Coach",
                badge: "Coaching only",
                bc: "#e8f4fd",
                tc: "#1a5ea8",
              },
              {
                init: "BN",
                bg: "#2ab87a",
                name: "Boris N.",
                role: "Coach",
                badge: "Coaching only",
                bc: "#e8f4fd",
                tc: "#1a5ea8",
              },
              {
                init: "MK",
                bg: "#d6c832",
                name: "Mila K.",
                role: "Receptionist",
                badge: "Bookings only",
                bc: "#fdfae0",
                tc: "#8a7800",
              },
            ].map((m) => (
              <div
                key={m.name}
                className="flex items-center gap-3 bg-[#f8f9f7] border border-[#e8ede4] rounded-xl px-3 py-2.5"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                  style={{ background: m.bg }}
                >
                  {m.init}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[#111c0a] truncate">
                    {m.name}
                  </div>
                  <div className="text-[10px] text-[#6e7f65]">{m.role}</div>
                </div>
                <span
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap"
                  style={{ background: m.bc, color: m.tc }}
                >
                  {m.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
