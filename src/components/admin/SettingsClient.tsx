"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import {
  Building2,
  Clock,
  CalendarOff,
  CreditCard,
  Bell,
  Shield,
  ChevronRight,
  Save,
  Upload,
  User,
  Check,
} from "lucide-react";
import type { Club, OpeningHours } from "@/types/database";
import {
  CANCEL_HOUR_CHOICES,
  DURATION_CHOICES,
  MAX_DAYS_AHEAD,
  NO_SHOW_CHOICES,
  NO_SHOW_DAYS,
  PER_DAY_CHOICES,
  type BookingRules,
} from "@/lib/bookingRules";
import {
  saveClubInfo,
  saveClubLogo,
  saveOpeningHours,
  saveBookingRules,
  type SaveResult,
} from "@/app/[locale]/admin/settings/actions";
import ProfileAvatarUpload from "@/components/profile/ProfileAvatarUpload";
import ProfileEditForm from "@/components/profile/ProfileEditForm";
import { initials } from "@/lib/avatar";

export type SettingsClub = Pick<
  Club,
  | "id"
  | "name"
  | "slug"
  | "email"
  | "phone"
  | "address"
  | "city"
  | "country"
  | "website"
  | "description"
  | "logo_url"
> & { opening_hours: OpeningHours; booking_rules: BookingRules };

type SettingsProfile = {
  userId: string;
  full_name: string;
  phone: string;
  avatar_url: string | null;
};

interface Props {
  club: SettingsClub;
  profile: SettingsProfile;
  /** Section to open first, e.g. "hours". */
  initialTab?: string;
}


// Sections marked "soon" are a preview: nothing in them is saved yet.
const SECTIONS = [
  { id: "club", icon: Building2, soon: false },
  { id: "hours", icon: Clock, soon: false },
  { id: "profile", icon: User, soon: false },
  { id: "booking", icon: CalendarOff, soon: false },
  { id: "payments", icon: CreditCard, soon: true },
  { id: "notifications", icon: Bell, soon: true },
  { id: "danger", icon: Shield, soon: true },
];

export default function SettingsClient({ club, profile, initialTab }: Props) {
  const t = useTranslations("settingsPage");
  const dayNames = t.raw("days") as string[];
  // ?tab=hours (from the getting-started checklist) opens that section.
  const [active, setActive] = useState(
    SECTIONS.some((s) => s.id === initialTab) ? initialTab! : "club",
  );
  const [rules, setRules] = useState<BookingRules>(club.booking_rules);
  const [hours, setHours] = useState(
    club.opening_hours.map((h, i) => ({ day: dayNames[i], ...h })),
  );
  const [info, setInfo] = useState({
    name: club.name,
    email: club.email ?? "",
    phone: club.phone ?? "",
    address: club.address ?? "",
    city: club.city ?? "",
    country: club.country ?? "",
    website: club.website ?? "",
    description: club.description ?? "",
  });
  const [logoUrl, setLogoUrl] = useState(club.logo_url);
  const [logoStatus, setLogoStatus] = useState<SaveResult | null>(null);
  const [logoPending, startLogo] = useTransition();
  const logoInput = useRef<HTMLInputElement>(null);

  const setField =
    (key: keyof typeof info) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setInfo((prev) => ({ ...prev, [key]: e.target.value }));

  const uploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("logo", file);
    startLogo(async () => {
      const result = await saveClubLogo(form);
      setLogoStatus(result);
      if (result.ok && result.url) setLogoUrl(result.url);
    });
    e.target.value = "";
  };

  const toggleDay = (i: number) => {
    setHours((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, open: !h.open } : h)),
    );
  };

  return (
    <div className="max-w-[900px] mx-auto flex gap-6 items-start">
      {/* Sidebar nav */}
      <div className="w-[200px] flex-shrink-0 bg-white border border-[#e8ede4] rounded-2xl p-2 sticky top-6">
        <p className="text-[11px] font-medium text-[#6e7f65] px-3 pt-2 pb-1 uppercase tracking-[0.06em]">
          {t("settings")}
        </p>
        {SECTIONS.map(({ id, icon: Icon, soon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-colors mb-0.5 ${
              active === id
                ? "bg-[#f3fbde] text-[#2e4d03] font-medium"
                : id === "danger"
                  ? "text-red-700 hover:bg-red-50"
                  : "text-[#3d4f35] hover:bg-[#f4f6f2]"
            }`}
          >
            <Icon size={14} strokeWidth={2} className="shrink-0" />
            <span className="flex-1 text-left">{t(`sections.${id}`)}</span>
            {soon && (
              <span className="rounded bg-[#f4f6f2] px-1.5 py-0.5 text-[10px] font-medium text-[#6e7f65]">
                {t("soon")}
              </span>
            )}
            {active === id && (
              <ChevronRight size={13} className="text-[#7aad12]" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Club Info */}
        {active === "club" && (
          <Section
            title={t("clubInfo")}
            description={t("basicInformationAboutYourClub")}
          >
            <Field label={t("clubLogo")}>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="w-16 h-16 rounded-xl border border-[#e8ede4] object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#f4f6f2] border border-[#e8ede4] flex items-center justify-center flex-shrink-0">
                    <Building2 size={24} className="text-[#6e7f65]" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  disabled={logoPending}
                  className="btn-secondary flex items-center gap-1.5 text-[13px] disabled:opacity-50"
                >
                  <Upload size={13} /> {logoPending ? t("uploading") : t("uploadLogo")}
                </button>
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadLogo}
                />
              </div>
              <StatusLine result={logoStatus} />
            </Field>

            <Field label={t("clubName")}>
              <input className="input" value={info.name} onChange={setField("name")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("email")}>
                <input className="input" type="email" value={info.email} onChange={setField("email")} />
              </Field>
              <Field label={t("phone")}>
                <input className="input" value={info.phone} onChange={setField("phone")} />
              </Field>
            </div>

            <Field label={t("address")}>
              <input className="input" value={info.address} onChange={setField("address")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("city")}>
                <input className="input" value={info.city} onChange={setField("city")} />
              </Field>
              <Field label={t("country")}>
                <input className="input" value={info.country} onChange={setField("country")} />
              </Field>
            </div>

            <Field label={t("website")}>
              <input
                className="input"
                placeholder="myclub.mk"
                value={info.website}
                onChange={setField("website")}
              />
            </Field>

            <Field label={t("description")}>
              <textarea
                className="input resize-y"
                rows={3}
                value={info.description}
                onChange={setField("description")}
              />
            </Field>

            <SaveButton onSave={() => saveClubInfo(info)} />
          </Section>
        )}

        {/* Opening Hours */}
        {active === "hours" && (
          <Section
            title={t("openingHours")}
            description={t("setYourClubsOperatingHours")}
          >
            <div className="flex flex-col gap-2">
              {hours.map((h, i) => (
                <div
                  key={h.day}
                  className={`grid items-center gap-3 px-4 py-3 rounded-xl border border-[#e8ede4] ${
                    h.open ? "bg-white" : "bg-[#f4f6f2]"
                  }`}
                  style={{ gridTemplateColumns: "130px 44px 1fr" }}
                >
                  <span
                    className={`text-[13px] font-medium ${h.open ? "text-[#111c0a]" : "text-[#6e7f65]"}`}
                  >
                    {h.day}
                  </span>
                  <ToggleSwitch
                    checked={h.open}
                    onChange={() => toggleDay(i)}
                  />
                  {h.open ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        className="input"
                        value={h.from}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((s, idx) =>
                              idx === i ? { ...s, from: e.target.value } : s,
                            ),
                          )
                        }
                        style={{ width: 110 }}
                      />
                      <span className="text-[13px] text-[#6e7f65]">{t("to")}</span>
                      <input
                        type="time"
                        className="input"
                        value={h.to}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((s, idx) =>
                              idx === i ? { ...s, to: e.target.value } : s,
                            ),
                          )
                        }
                        style={{ width: 110 }}
                      />
                    </div>
                  ) : (
                    <span className="text-[13px] text-[#6e7f65]">{t("closed")}</span>
                  )}
                </div>
              ))}
            </div>
            <SaveButton
              onSave={() =>
                saveOpeningHours(hours.map(({ open, from, to }) => ({ open, from, to })))
              }
            />
          </Section>
        )}

        {/* Your profile */}
        {active === "profile" && (
          <Section
            title={t("yourProfile")}
            description={t("yourOwnNamePhoneAnd")}
          >
            <div className="flex items-center gap-4">
              <ProfileAvatarUpload
                userId={profile.userId}
                avatarUrl={profile.avatar_url}
                initials={initials(profile.full_name, "A")}
              />
              <p className="text-[13px] text-[#6e7f65]">
                {t("clickTheCameraToUpload")}
              </p>
            </div>
            <ProfileEditForm
              userId={profile.userId}
              defaultValues={{ full_name: profile.full_name, phone: profile.phone }}
            />
          </Section>
        )}

        {/* Booking Rules */}
        {active === "booking" && (
          <Section
            title={t("bookingRules")}
            description={t("whatPlayersCanBookOnline")}
          >
            <Field label={t("bookingLengthsPlayersCanChoose")}>
              <div className="flex flex-wrap gap-2">
                {DURATION_CHOICES.map((d) => {
                  const on = rules.durations.includes(d);
                  return (
                    <label
                      key={d}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors ${
                        on
                          ? "border-[#7aad12] bg-[#f3fbde] text-[#111c0a]"
                          : "border-[#e8ede4] text-[#3d4f35] hover:bg-[#f4f6f2]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setRules((r) => ({
                            ...r,
                            durations: on
                              ? r.durations.filter((x) => x !== d)
                              : [...r.durations, d].sort((a, b) => a - b),
                          }))
                        }
                      />
                      {t("minutes", { n: d })}
                    </label>
                  );
                })}
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("bookUpToDaysAhead")}>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_DAYS_AHEAD}
                  value={rules.max_days_ahead}
                  onChange={(e) =>
                    setRules((r) => ({ ...r, max_days_ahead: Number(e.target.value) }))
                  }
                />
              </Field>
              <Field label={t("bookingsPerPlayerPerDay")}>
                <select
                  className="input"
                  value={rules.max_per_day}
                  onChange={(e) =>
                    setRules((r) => ({ ...r, max_per_day: Number(e.target.value) }))
                  }
                >
                  {PER_DAY_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? t("noLimit") : n}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("cancellingOnline")}>
                  <select
                    className="input"
                    value={rules.cancel_hours}
                    onChange={(e) =>
                      setRules((r) => ({ ...r, cancel_hours: Number(e.target.value) }))
                    }
                  >
                    {CANCEL_HOUR_CHOICES.map((h) => (
                      <option key={h} value={h}>
                        {h === 0 ? t("cancelAnyTime") : t("cancelUntil", { h })}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            <Field label={t("repeatNoShows")}>
              <select
                className="input"
                value={rules.max_no_shows}
                onChange={(e) =>
                  setRules((r) => ({ ...r, max_no_shows: Number(e.target.value) }))
                }
              >
                {NO_SHOW_CHOICES.map((n) => (
                  <option key={n} value={n}>
                    {n === 0
                      ? t("neverPause")
                      : t("pauseAfter", { n })}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[12px] text-[#6e7f65]">
                {t("noShowHelp", { days: NO_SHOW_DAYS })}
              </p>
            </Field>

            <p className="text-[12px] text-[#6e7f65]">
              {t("playersSeeOnly")}
            </p>

            <SaveButton onSave={() => saveBookingRules(rules)} />
          </Section>
        )}

        {/* Payments */}
        {active === "payments" && (
          <Section
            title={t("payments")}
            soon
            description={t("configurePricingCurrencyAndPayment")}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("currency")}>
                <select className="input">
                  <option>EUR — €</option>
                  <option>USD — $</option>
                  <option>MKD — ден</option>
                  <option>GBP — £</option>
                </select>
              </Field>
              <Field label={t("taxRate")}>
                <input className="input" type="number" defaultValue={18} />
              </Field>
            </div>

            <Field label={t("stripeIntegration")}>
              <div className="flex items-center justify-between p-4 bg-[#f4f6f2] border border-[#e8ede4] rounded-xl">
                <div>
                  <p className="text-[13px] font-medium text-[#111c0a]">
                    {t("stripe")}
                  </p>
                  <p className="text-[12px] text-[#6e7f65] mt-0.5">
                    {t("notConnected")}
                  </p>
                </div>
                <button className="btn-primary text-[13px]">
                  {t("connectStripe")}
                </button>
              </div>
            </Field>

            <Field label={t("onlinePayments")}>
              <Toggle
                label={t("requirePaymentAtTimeOf")}
                defaultChecked
              />
            </Field>

            <Field label={t("refunds")}>
              <Toggle
                label={t("allowAutomaticRefundsOnCancellation")}
                defaultChecked
              />
            </Field>

            <SaveButton soon />
          </Section>
        )}

        {/* Notifications */}
        {active === "notifications" && (
          <Section
            title={t("notifications")}
            soon
            description={t("chooseWhichEmailNotificationsAre")}
          >
            <div className="flex flex-col divide-y divide-[#e8ede4]">
              {[
                {
                  label: t("bookingConfirmed"),
                  sub: t("sentToMemberWhenA"),
                },
                {
                  label: t("bookingCancelled"),
                  sub: t("sentWhenABookingIs"),
                },
                {
                  label: t("bookingReminder"),
                  sub: t("sent24hBeforeTheBooking"),
                },
                {
                  label: t("newMemberJoined"),
                  sub: t("sentToAdminWhenA"),
                },
                {
                  label: t("paymentReceived"),
                  sub: t("sentToMemberAfterSuccessful"),
                },
                {
                  label: t("cancellationRefundIssued"),
                  sub: t("sentWhenARefundIs"),
                },
              ].map(({ label, sub }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-3.5"
                >
                  <div>
                    <p className="text-[13px] font-medium text-[#111c0a]">
                      {label}
                    </p>
                    <p className="text-[12px] text-[#6e7f65] mt-0.5">{sub}</p>
                  </div>
                  <ToggleSwitch defaultChecked />
                </div>
              ))}
            </div>
            <Field label={t("replyToEmail")}>
              <input className="input" defaultValue={club.email ?? ""} />
            </Field>
            <SaveButton soon />
          </Section>
        )}

        {/* Danger Zone */}
        {active === "danger" && (
          <Section
            title={t("dangerZone")}
            soon
            description={t("irreversibleActionsProceedWithCaution")}
          >
            <DangerCard
              title={t("exportAllData")}
              description={t("downloadAFullExportOf")}
              action={t("exportData")}
              variant="default"
            />
            <DangerCard
              title={t("clearAllBookings")}
              description={t("permanentlyDeleteAllBookingHistory")}
              action={t("clearBookings")}
              variant="warning"
            />
            <DangerCard
              title={t("deleteClub")}
              description={t("permanentlyDeleteYourClubAnd")}
              action={t("deleteClub2")}
              variant="danger"
            />
          </Section>
        )}
      </div>
    </div>
  );
}

// ── Reusable sub-components ────────────────────────────────────────────────

function Section({
  title,
  description,
  soon = false,
  children,
}: {
  title: string;
  description: string;
  /** A preview of a setting that isn't saved yet. */
  soon?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("settingsPage");
  return (
    <div className="bg-white border border-[#e8ede4] rounded-2xl p-7">
      <div className="mb-6 pb-5 border-b border-[#e8ede4]">
        <h2 className="text-[18px] font-semibold text-[#111c0a]">{title}</h2>
        <p className="text-[13px] text-[#6e7f65] mt-1">{description}</p>
        {soon && (
          <p className="mt-3 rounded-lg bg-[#fdfae0] px-3 py-2 text-[12px] text-[#8a7800]">
            {t("comingSoonTheseSettingsAre")}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#3d4f35]">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  defaultChecked,
}: {
  label: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked ?? false);
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <ToggleSwitch checked={checked} onChange={setChecked} />
      <span className="text-[13px] text-[#3d4f35]">{label}</span>
    </label>
  );
}

function ToggleSwitch({
  defaultChecked,
  checked: controlledChecked,
  onChange,
}: {
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const [internal, setInternal] = useState(defaultChecked ?? false);
  const isOn = controlledChecked !== undefined ? controlledChecked : internal;

  return (
    <div
      onClick={() => {
        setInternal(!isOn);
        onChange?.(!isOn);
      }}
      className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${
        isOn ? "bg-[#7aad12]" : "bg-[#d0d9c9]"
      }`}
    >
      <div
        className={`absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white transition-all ${
          isOn ? "left-[18px]" : "left-[3px]"
        }`}
      />
    </div>
  );
}

function SaveButton({
  onSave,
  soon = false,
}: {
  onSave?: () => Promise<SaveResult>;
  soon?: boolean;
}) {
  const t = useTranslations("settingsPage");
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, start] = useTransition();

  const click = () => {
    if (!onSave) return;
    setResult(null);
    start(async () => setResult(await onSave()));
  };

  return (
    <div className="pt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={click}
        disabled={soon || pending}
        className="btn-primary flex items-center gap-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Save size={13} /> {pending ? t("saving") : t("saveChanges")}
      </button>
      <StatusLine result={result} />
    </div>
  );
}

function StatusLine({ result }: { result: SaveResult | null }) {
  const t = useTranslations("settingsPage");
  if (!result) return null;
  return result.ok ? (
    <span className="flex items-center gap-1 text-[12px] text-[#4d7a08]">
      <Check size={13} /> {t("saved")}
    </span>
  ) : (
    <span role="alert" className="text-[12px] text-red-600">
      {result.error}
    </span>
  );
}

function DangerCard({
  title,
  description,
  action,
  variant,
}: {
  title: string;
  description: string;
  action: string;
  variant: "default" | "warning" | "danger";
}) {
  const styles = {
    default: {
      wrap: "bg-white border-[#e8ede4]",
      btn: "border-[#d0d9c9] bg-[#f4f6f2] text-[#3d4f35] hover:bg-[#e8ede4]",
    },
    warning: {
      wrap: "bg-[#fffbf5] border-[#fcd9a8]",
      btn: "border-[#fcd9a8] bg-[#fef3e8] text-[#92400e] hover:bg-[#fde8c8]",
    },
    danger: {
      wrap: "bg-[#fff5f5] border-[#fecaca]",
      btn: "border-[#fecaca] bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca]",
    },
  }[variant];

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-xl border ${styles.wrap}`}
    >
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-[13px] font-medium text-[#111c0a]">{title}</p>
        <p className="text-[12px] text-[#6e7f65] mt-0.5">{description}</p>
      </div>
      <button
        className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${styles.btn}`}
      >
        {action}
      </button>
    </div>
  );
}
