"use client";

import { useTranslations } from "next-intl";
import PaymentsSettings, {
  type PaymentsInfo,
} from "@/components/admin/PaymentsSettings";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Building2,
  Clock,
  CalendarOff,
  CreditCard,
  Database,
  Download,
  Mail,
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
import { SALES_EMAIL } from "@/lib/plans";
import { useReadOnly } from "@/components/admin/ReadOnly";
import SelectField from "@/components/ui/SelectField";

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
  /** Online payments (Stripe). */
  payments: PaymentsInfo;
  /** Section to open first, e.g. "hours". */
  initialTab?: string;
}

const SECTIONS = [
  { id: "club", icon: Building2 },
  { id: "hours", icon: Clock },
  { id: "profile", icon: User },
  { id: "booking", icon: CalendarOff },
  { id: "payments", icon: CreditCard },
  { id: "data", icon: Database },
];

export default function SettingsClient({
  club,
  profile,
  payments,
  initialTab,
}: Props) {
  const t = useTranslations("settingsPage");
  const { readOnly, hint } = useReadOnly();
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
  const nav = useRef<HTMLElement>(null);

  // On phones the tabs scroll sideways: keep the open one in view.
  useEffect(() => {
    const row = nav.current;
    const tab = row?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    const left = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

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
    <div className="max-w-[900px] mx-auto flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
      {/* Section nav: a scrollable row of tabs on phones, a sidebar from md up */}
      <nav
        ref={nav}
        aria-label={t("settings")}
        className="relative flex gap-1 overflow-x-auto rounded-2xl border border-[#e8ede4] bg-white p-1.5 md:sticky md:top-6 md:w-[200px] md:shrink-0 md:flex-col md:gap-0 md:overflow-visible md:p-2"
      >
        <p className="hidden px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6e7f65] md:block">
          {t("settings")}
        </p>
        {SECTIONS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            data-tab={id}
            onClick={() => setActive(id)}
            aria-current={active === id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-[13px] transition-colors md:mb-0.5 md:w-full cursor-pointer ${
              active === id
                ? "bg-[#f3fbde] text-[#2e4d03] font-medium"
                : "text-[#3d4f35] hover:bg-[#f4f6f2]"
            }`}
          >
            <Icon size={14} strokeWidth={2} className="shrink-0" />
            <span className="flex-1 text-left">{t(`sections.${id}`)}</span>
            {active === id && (
              <ChevronRight
                size={13}
                className="hidden text-[#7aad12] md:block"
              />
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Club Info */}
        {active === "club" && (
          <Section
            title={t("clubInfo")}
            description={t("basicInformationAboutYourClub")}
          >
            <Field label={t("clubLogo")}>
              <div className="flex flex-wrap items-center gap-4">
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
                  title={hint}
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  disabled={readOnly || logoPending}
                  className="btn-secondary flex items-center gap-1.5 text-[13px] disabled:opacity-50"
                >
                  <Upload size={13} />{" "}
                  {logoPending ? t("uploading") : t("uploadLogo")}
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
              <input
                className="input"
                value={info.name}
                onChange={setField("name")}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("email")}>
                <input
                  className="input"
                  type="email"
                  value={info.email}
                  onChange={setField("email")}
                />
              </Field>
              <Field label={t("phone")}>
                <input
                  className="input"
                  value={info.phone}
                  onChange={setField("phone")}
                />
              </Field>
            </div>

            <Field label={t("address")}>
              <input
                className="input"
                value={info.address}
                onChange={setField("address")}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("city")}>
                <input
                  className="input"
                  value={info.city}
                  onChange={setField("city")}
                />
              </Field>
              <Field label={t("country")}>
                <input
                  className="input"
                  value={info.country}
                  onChange={setField("country")}
                />
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
                  className={`grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[#e8ede4] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_44px_auto] ${
                    h.open ? "bg-white" : "bg-[#f4f6f2]"
                  }`}
                >
                  <span
                    className={`text-[13px] font-medium ${h.open ? "text-[#111c0a]" : "text-[#6e7f65]"}`}
                  >
                    {h.day}
                  </span>
                  <ToggleSwitch
                    checked={h.open}
                    label={h.day}
                    onChange={() => toggleDay(i)}
                  />
                  {h.open ? (
                    <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                      <input
                        type="time"
                        className="input min-w-0 flex-1 sm:w-[136px] sm:flex-none"
                        value={h.from}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((s, idx) =>
                              idx === i ? { ...s, from: e.target.value } : s,
                            ),
                          )
                        }
                      />
                      <span className="text-[13px] text-[#6e7f65]">
                        {t("to")}
                      </span>
                      <input
                        type="time"
                        className="input min-w-0 flex-1 sm:w-[136px] sm:flex-none"
                        value={h.to}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((s, idx) =>
                              idx === i ? { ...s, to: e.target.value } : s,
                            ),
                          )
                        }
                      />
                    </div>
                  ) : (
                    <span className="col-span-2 text-[13px] text-[#6e7f65] sm:col-span-1">
                      {t("closed")}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <SaveButton
              onSave={() =>
                saveOpeningHours(
                  hours.map(({ open, from, to }) => ({ open, from, to })),
                )
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
              defaultValues={{
                full_name: profile.full_name,
                phone: profile.phone,
              }}
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
                    setRules((r) => ({
                      ...r,
                      max_days_ahead: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label={t("bookingsPerPlayerPerDay")}>
                <SelectField
                  ariaLabel={t("bookingsPerPlayerPerDay")}
                  value={String(rules.max_per_day)}
                  onChange={(v) =>
                    setRules((r) => ({ ...r, max_per_day: Number(v) }))
                  }
                  options={PER_DAY_CHOICES.map((n) => ({
                    value: String(n),
                    label: n === 0 ? t("noLimit") : String(n),
                  }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("cancellingOnline")}>
                  <SelectField
                    ariaLabel={t("cancellingOnline")}
                    value={String(rules.cancel_hours)}
                    onChange={(v) =>
                      setRules((r) => ({ ...r, cancel_hours: Number(v) }))
                    }
                    options={CANCEL_HOUR_CHOICES.map((h) => ({
                      value: String(h),
                      label:
                        h === 0 ? t("cancelAnyTime") : t("cancelUntil", { h }),
                    }))}
                  />
                </Field>
              </div>
            </div>

            <Field label={t("repeatNoShows")}>
              <SelectField
                ariaLabel={t("repeatNoShows")}
                value={String(rules.max_no_shows)}
                onChange={(v) =>
                  setRules((r) => ({ ...r, max_no_shows: Number(v) }))
                }
                options={NO_SHOW_CHOICES.map((n) => ({
                  value: String(n),
                  label: n === 0 ? t("neverPause") : t("pauseAfter", { n }),
                }))}
              />
              <p className="mt-1.5 text-[12px] text-[#6e7f65]">
                {t("noShowHelp", { days: NO_SHOW_DAYS })}
              </p>
            </Field>

            <p className="text-[12px] text-[#6e7f65]">{t("playersSeeOnly")}</p>

            <SaveButton onSave={() => saveBookingRules(rules)} />
          </Section>
        )}

        {/* Your data */}
        {active === "payments" && <PaymentsSettings info={payments} />}

        {active === "data" && (
          <Section title={t("data.title")} description={t("data.description")}>
            <DataRow
              title={t("data.bookings")}
              description={t("data.bookingsDesc")}
              action={
                <a
                  href="/api/export?type=bookings"
                  download
                  className={DATA_BUTTON}
                >
                  <Download size={13} /> {t("data.download")}
                </a>
              }
            />
            <DataRow
              title={t("data.members")}
              description={t("data.membersDesc")}
              action={
                <a
                  href="/api/export?type=members"
                  download
                  className={DATA_BUTTON}
                >
                  <Download size={13} /> {t("data.download")}
                </a>
              }
            />
            <DataRow
              danger
              title={t("data.deleteTitle")}
              description={t("data.deleteDesc")}
              action={
                <a
                  href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(
                    t("data.deleteSubject", { name: club.name }),
                  )}`}
                  className={`${DATA_BUTTON} border-[#fecaca] bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca]`}
                >
                  <Mail size={13} /> {t("data.deleteAction")}
                </a>
              }
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
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#e8ede4] rounded-2xl p-5 sm:p-7">
      <div className="mb-6 pb-5 border-b border-[#e8ede4]">
        <h2 className="text-[18px] font-semibold text-[#111c0a]">{title}</h2>
        <p className="text-[13px] text-[#6e7f65] mt-1">{description}</p>
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

function ToggleSwitch({
  defaultChecked,
  checked: controlledChecked,
  label,
  onChange,
}: {
  defaultChecked?: boolean;
  checked?: boolean;
  label?: string;
  onChange?: (v: boolean) => void;
}) {
  const [internal, setInternal] = useState(defaultChecked ?? false);
  const isOn = controlledChecked !== undefined ? controlledChecked : internal;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={label}
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
    </button>
  );
}

function SaveButton({ onSave }: { onSave: () => Promise<SaveResult> }) {
  const t = useTranslations("settingsPage");
  const { readOnly, hint } = useReadOnly();
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, start] = useTransition();

  const click = () => {
    setResult(null);
    start(async () => setResult(await onSave()));
  };

  return (
    <div className="pt-2 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={click}
        disabled={readOnly || pending}
        title={hint}
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

const DATA_BUTTON =
  "inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[#d0d9c9] bg-[#f4f6f2] px-4 py-1.5 text-[13px] font-medium text-[#3d4f35] transition-colors hover:bg-[#e8ede4]";

function DataRow({
  title,
  description,
  action,
  danger = false,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        danger ? "border-[#fecaca] bg-[#fff5f5]" : "border-[#e8ede4] bg-white"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#111c0a]">{title}</p>
        <p className="mt-0.5 text-[12px] text-[#6e7f65]">{description}</p>
      </div>
      {action}
    </div>
  );
}
