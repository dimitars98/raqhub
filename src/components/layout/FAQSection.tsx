"use client";

import { useState } from "react";
import { Plus, Mail } from "lucide-react";

const faqs = [
  {
    q: "How long does it take to set up?",
    a: "Create your club, add your courts with their prices, and you can take your first booking the same day. There's nothing to install and no training needed. If you get stuck, write to us and we'll help you set it up.",
  },
  {
    q: "What does it cost?",
    a: "The Starter plan is free for one court and up to 20 members, with no time limit. The Club plan is €29 a month for unlimited courts and members. There's no setup fee, and you can cancel at any time.",
  },
  {
    q: "Do my players need to download an app?",
    a: "No. ServeTime runs in the browser on any phone, tablet or computer. Players open your club's booking link, sign up with their email or Google account, and book a court.",
  },
  {
    q: "Can I still take bookings by phone or in person?",
    a: "Yes. You can add a booking yourself for a member or a walk-in, so everything ends up in one timetable no matter how the player reached you.",
  },
  {
    q: "Which sports and courts does it support?",
    a: "Tennis, padel and pickleball. Each court has its own sport, surface, indoor or outdoor setting and hourly price, so a club with mixed courts can run them all from one place.",
  },
  {
    q: "Can players pay online?",
    a: "Not yet. Online payment is in development. For now, players pay at the club the way they do today, and ServeTime records the price of every booking so you can see what each court brings in.",
  },
  {
    q: "Which languages is it available in?",
    a: "English, German and Macedonian. Each person chooses their own language, so staff and players can use different ones.",
  },
  {
    q: "What happens to our data if we stop using ServeTime?",
    a: "Your club's data belongs to you. If you decide to leave, tell us and we'll delete your club, members and bookings.",
  },
];

function SupportBlock({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-base font-semibold text-ink-900">
        Still have questions?
      </p>
      <p className="mt-1 text-sm text-ink-600">
        Write to us and we&apos;ll get back to you.
      </p>
      <a
        href="mailto:support@servetime.com"
        className="btn-primary mt-4 h-12 px-6 text-sm font-semibold"
      >
        <Mail size={16} className="text-brand-400" aria-hidden="true" />
        Contact support
      </a>
    </div>
  );
}

export default function FAQSection() {
  // The first question starts open so the section doesn't look like a bare list.
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section id="faq" className="px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
      {/* Pale green panel that holds the whole section */}
      <div className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[2rem] border border-brand-200 bg-brand-50 px-5 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
        {/* Oversized tennis ball, cropped by the panel's bottom-left corner */}
        <svg
          aria-hidden="true"
          viewBox="0 0 200 200"
          className="pointer-events-none absolute -bottom-28 -left-24 hidden size-80 -rotate-12 lg:block"
        >
          <circle cx="100" cy="100" r="100" className="fill-brand-400" />
          <path
            d="M34 26C78 66 78 134 34 174"
            fill="none"
            stroke="white"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M166 26C122 66 122 134 166 174"
            fill="none"
            stroke="white"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </svg>

        <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          {/* Heading column */}
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-200 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-900">
              <span className="size-1.5 rounded-full bg-brand-600" />
              FAQ
            </div>
            <h2 className="font-display mb-4 text-[30px] font-extrabold leading-[1.1] tracking-tight text-ink-900 sm:text-[36px] lg:text-[44px]">
              Got questions?
              <br />
              We&apos;ve got{" "}
              <span className="underline decoration-brand-400 decoration-[6px] underline-offset-[6px]">
                answers.
              </span>
            </h2>
            <p className="max-w-[420px] text-[15px] leading-relaxed text-ink-600">
              What club owners ask us most before getting started.
            </p>

            <SupportBlock className="mt-9 hidden lg:block" />
          </div>

          {/* Questions */}
          <div>
            <div className="flex flex-col gap-3">
              {faqs.map((item, i) => {
                const isOpen = openIndex === i;
                const buttonId = `faq-question-${i}`;
                const panelId = `faq-answer-${i}`;

                return (
                  <div
                    key={item.q}
                    className={`relative overflow-hidden rounded-2xl border bg-white transition-all duration-200 ${
                      isOpen
                        ? "border-brand-600 shadow-lg shadow-brand-900/5"
                        : "border-brand-200 hover:border-brand-400"
                    }`}
                  >
                    {/* Lime bar down the left edge of the open question */}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 w-1.5 bg-brand-400 transition-opacity duration-200 ${
                        isOpen ? "opacity-100" : "opacity-0"
                      }`}
                    />

                    <h3>
                      <button
                        type="button"
                        id={buttonId}
                        onClick={() => toggle(i)}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus:outline-none sm:px-6 sm:py-5"
                      >
                        <span className="text-[15px] font-semibold leading-snug text-ink-900 sm:text-base">
                          {item.q}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-brand-600 group-focus-visible:ring-offset-2 ${
                            isOpen
                              ? "bg-brand-400 text-ink-900"
                              : "bg-brand-100 text-brand-900 group-hover:bg-brand-200"
                          }`}
                        >
                          {/* One icon: the plus turns into a cross when open */}
                          <Plus
                            size={18}
                            strokeWidth={2.25}
                            className={`transition-transform duration-200 ${
                              isOpen ? "rotate-45" : ""
                            }`}
                          />
                        </span>
                      </button>
                    </h3>

                    {/* Animates to the answer's real height, however long it is */}
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div
                        className={`overflow-hidden ${isOpen ? "" : "invisible"}`}
                      >
                        <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-600 sm:px-6 sm:pb-6 sm:pr-16">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <SupportBlock className="mt-9 lg:hidden" />
          </div>
        </div>
      </div>
    </section>
  );
}
