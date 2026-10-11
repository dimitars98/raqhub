const testimonials: {
  q: string;
  name: string;
  role: string;
  init: string;
  bg: string;
}[] = [];

export default function Testimonials() {
  if (testimonials.length === 0) return null;

  return (
    <section className="max-w-[1180px] mx-auto px-6 py-16 lg:px-10 lg:py-24">
      <div className="text-center mb-10 lg:mb-14">
        <div className="text-[11px] font-semibold text-[#7aad12] uppercase tracking-widest mb-3">
          What clubs say
        </div>
        <h2 className="font-display text-[28px] sm:text-[34px] lg:text-[40px] font-extrabold text-[#111c0a] tracking-tight leading-[1.1]">
          From the clubs using ServeTime
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {testimonials.map((t) => (
          <div
            key={t.name}
            className="bg-white border border-[#e8ede4] rounded-2xl p-6 sm:p-8"
          >
            <p className="text-[15px] text-[#3d4f35] leading-relaxed italic font-light mb-6">
              &quot;{t.q}&quot;
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                style={{ background: t.bg }}
              >
                {t.init}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[#111c0a]">
                  {t.name}
                </div>
                <div className="text-[11px] text-[#6e7f65]">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
