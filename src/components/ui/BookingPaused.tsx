import { getTranslations } from "next-intl/server";
import { Mail, PauseCircle, Phone } from "lucide-react";

// Shown to players where a club would take bookings or sign-ups, while the
// club's account is read-only after its free trial (20261025_trial_lock.sql).
export default async function BookingPaused({
  clubName,
  phone,
  email,
  className = "",
}: {
  clubName?: string | null;
  phone?: string | null;
  email?: string | null;
  className?: string;
}) {
  const t = await getTranslations("paused");
  return (
    <section
      role="status"
      className={`flex flex-col gap-4 rounded-2xl border border-ink-100 bg-ink-50 p-5 sm:flex-row sm:items-start sm:p-6 ${className}`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-ink-600 ring-1 ring-ink-100">
        <PauseCircle size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink-900">{t("title")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          {clubName ? t("bodyNamed", { club: clubName }) : t("body")}
        </p>
        {(phone || email) && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-ink-900 hover:text-brand-800">
                <Phone size={14} aria-hidden="true" />
                {phone}
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 text-ink-900 hover:text-brand-800">
                <Mail size={14} aria-hidden="true" />
                {email}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
