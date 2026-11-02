import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import Navbar from "@/components/layout/Navbar";
// The previous hero is kept in src/components/layout/Hero.tsx: to switch
// back, import it here and use <Hero /> instead of <HeroProduct />.
import HeroProduct from "@/components/landing/HeroProduct";
import FAQSection from "@/components/landing/FAQSection";
import TeamSection from "@/components/landing/TeamSection";
import Footer from "@/components/landing/Footer";
import CTA from "@/components/landing/CTA";
import Pricing from "@/components/landing/Pricing";
import FeatureCards from "@/components/landing/FeatureCards";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Testimonials from "@/components/landing/Testimonials";
import { TRIAL_DAYS } from "@/lib/plans";
import { homeFor } from "@/lib/roles";
import Reveal from "@/components/ui/Reveal";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const locale = await getLocale();

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (data as { role: string } | null)?.role;
    redirect(`/${locale}${homeFor(role)}`);
  }

  const ta = await getTranslations("announcement");

  // Real quotes only, added with the person's permission.

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ANNOUNCEMENT BAR */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-[#111c0a] px-4 py-2.5 text-center text-[13px] text-white">
        <strong className="text-white">
          {ta("free", { days: TRIAL_DAYS })}
        </strong>
        <span className="text-white/75">{ta("noCard")}</span>
        <a
          href="#pricing"
          className="ml-1 font-medium text-[#a8d832] hover:underline"
        >
          {ta("link")}
        </a>
      </div>

      <Navbar />

      {/* HERO */}
      <HeroProduct />
      {/* <section className="max-w-[1180px] mx-auto px-10 pt-20 pb-0 grid grid-cols-2 gap-16 items-start">
        <div className="pt-3">
          <div className="inline-flex items-center gap-2 bg-[#f3fbde] border border-[#d6f09a] text-[#7aad12] text-[11px] font-semibold px-3 py-1.5 rounded-md mb-6 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7aad12]" />
            Tennis club management platform
          </div>
          <h1 className="font-display text-[58px] font-extrabold leading-[1.02] text-[#111c0a] tracking-[-2.5px] mb-5">
            Grow your club
            <br />
            the <span className="text-[#7aad12]">right way.</span>
          </h1>
          <p className="text-[17px] text-[#6e7f65] leading-[1.75] font-light max-w-[420px] mb-9">
            RaqHub powers everything from reservations and memberships to
            coaching and payments — the complete platform built for tennis
            clubs.
          </p>
          <div className="flex gap-3 flex-wrap mb-9">
            <Link
              href={`/${locale}/signup?role=admin`}
              className="inline-flex items-center gap-2 bg-[#111c0a] text-white text-[15px] font-medium px-6 py-3.5 rounded-lg hover:bg-[#1e3410] transition-all hover:-translate-y-px"
            >
              Start free trial <ArrowRight size={15} />
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center bg-white text-[#111c0a] text-[15px] font-medium px-6 py-3.5 rounded-lg border border-[#e8ede4] hover:border-[#7aad12] hover:bg-[#f3fbde] transition-all"
            >
              See a demo
            </Link>
          </div>
          <div className="flex items-center gap-4 pt-7 border-t border-[#e8ede4]">
            <div className="flex">
              {[
                ["#3a7020", "MK"],
                ["#7aad12", "AJ"],
                ["#d6c832", "DP"],
                ["#2ab87a", "NR"],
              ].map(([bg, init], i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-white -mr-2 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: bg, zIndex: 4 - i }}
                >
                  {init}
                </div>
              ))}
            </div>
            <div>
              <div className="text-[#d6c832] tracking-widest text-[12px]">
                ★★★★★
              </div>
              <div className="text-[13px] text-[#6e7f65]">
                Trusted by{" "}
                <strong className="text-[#111c0a]">500+ clubs</strong> across
                Europe
              </div>
            </div>
          </div>
        </div>

        <div className="relative pb-10">
      
          <div className="absolute -top-4 -right-4 z-10 bg-white border border-[#e8ede4] rounded-xl px-3 py-2.5 flex items-center gap-3 shadow-lg">
            <div className="w-8 h-8 rounded-lg bg-[#f3fbde] flex items-center justify-center">
              <Check size={16} className="text-[#7aad12]" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#111c0a]">
                Booking confirmed
              </div>
              <div className="text-[11px] text-[#6e7f65]">
                Court 2 · Ana M. · 18:00
              </div>
            </div>
          </div>

    
          <div className="bg-white border border-[#e8ede4] rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(17,28,10,.1)]">
            <div className="bg-[#111c0a] px-5 py-3.5 flex justify-between items-center">
              <span className="font-display font-bold text-white text-[14px]">
                Court Scheduler
              </span>
              <span className="text-white/50 text-[11px]">
                Tue, Apr 22 · 8 courts
              </span>
            </div>
            <div className="flex border-b border-[#e8ede4] bg-[#f8f9f7] text-[12px]">
              {["Availability", "Bookings", "Members", "Analytics"].map(
                (tab, i) => (
                  <div
                    key={tab}
                    className={`px-4 py-2.5 cursor-pointer border-b-2 transition-colors ${i === 0 ? "border-[#7aad12] text-[#7aad12] font-medium bg-white" : "border-transparent text-[#6e7f65]"}`}
                  >
                    {tab}
                  </div>
                ),
              )}
            </div>
            <div className="p-5">
              <div className="text-[10px] font-semibold text-[#6e7f65] uppercase tracking-wider mb-3">
                Court 1 — Clay
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { t: "08:00", s: "busy" },
                  { t: "09:30", s: "free" },
                  { t: "11:00", s: "mine" },
                  { t: "12:30", s: "free" },
                  { t: "14:00", s: "free" },
                  { t: "15:30", s: "busy" },
                  { t: "17:00", s: "busy" },
                  { t: "18:30", s: "free" },
                ].map(({ t, s }) => (
                  <div
                    key={t}
                    className={`rounded-lg p-2 text-center text-[11px] font-medium ${
                      s === "free"
                        ? "bg-[#f3fbde] text-[#7aad12] border border-[#d6f09a]"
                        : s === "mine"
                          ? "bg-[#111c0a] text-white"
                          : "bg-[#f4f4f4] text-[#bbb] border border-[#eee]"
                    }`}
                  >
                    <div>{t}</div>
                    <div className="text-[9px] mt-0.5 opacity-70">
                      {s === "mine" ? "Mine" : s === "free" ? "Free" : "Taken"}
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-px bg-[#e8ede4] my-3" />
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["18", "Bookings today"],
                  ["91%", "Utilisation"],
                  ["€520", "Revenue"],
                ].map(([v, l]) => (
                  <div key={l} className="bg-[#f8f9f7] rounded-lg p-3">
                    <div className="font-display text-xl font-bold text-[#111c0a]">
                      {v}
                    </div>
                    <div className="text-[10px] text-[#6e7f65] mt-0.5">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        
          <div className="absolute -bottom-2 -left-4 z-10 bg-white border border-[#e8ede4] rounded-xl px-3 py-2.5 flex items-center gap-3 shadow-lg">
            <div className="w-8 h-8 rounded-lg bg-[#e8f4fd] flex items-center justify-center">
              <Users size={15} className="text-[#1a5ea8]" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#111c0a]">
                New member joined
              </div>
              <div className="text-[11px] text-[#6e7f65]">
                Marko K. · Club plan
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* Each section below slides up as it scrolls into view (Reveal). */}
      {/* STATS STRIP — floating overlap */}
      <Reveal>
        <TeamSection />
      </Reveal>
      {/* FEATURE SHOWCASE — alternating sections */}
      <Reveal>
        <Features />
      </Reveal>
      {/* HOW IT WORKS */}
      <Reveal>
        <HowItWorks />
      </Reveal>
      {/* TESTIMONIALS */}
      <Reveal>
        <Testimonials />
      </Reveal>
      {/* FEATURE CARDS GRID */}
      <Reveal>
        <FeatureCards />
      </Reveal>
      {/* PRICING */}
      <Reveal>
        <Pricing />
      </Reveal>
      <Reveal>
        <FAQSection />
      </Reveal>

      {/* CTA */}
      <Reveal>
        <CTA />
      </Reveal>
      {/* FOOTER */}
      <Footer />
    </div>
  );
}
