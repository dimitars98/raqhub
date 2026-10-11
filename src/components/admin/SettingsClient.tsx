"use client";

import { useState } from "react";
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
} from "lucide-react";
import type { Club } from "@/types/database";

type ClubProp = Pick<
  Club,
  | "id"
  | "name"
  | "email"
  | "phone"
  | "address"
  | "city"
  | "country"
  | "description"
  | "logo_url"
>;

interface Props {
  club: ClubProp;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SPORTS = ["Tennis", "Padel", "Pickleball"];

const SECTIONS = [
  { id: "club", label: "Club Info", icon: Building2 },
  { id: "hours", label: "Opening Hours", icon: Clock },
  { id: "booking", label: "Booking Rules", icon: CalendarOff },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "danger", label: "Danger Zone", icon: Shield },
];

export default function SettingsClient({ club }: Props) {
  const [active, setActive] = useState("club");
  const [sports, setSports] = useState(["Tennis"]);
  const [hours, setHours] = useState(
    DAYS.map((day) => ({ day, open: true, from: "07:00", to: "22:00" })),
  );

  const toggleSport = (sport: string) => {
    setSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport],
    );
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
          Settings
        </p>
        {SECTIONS.map(({ id, label, icon: Icon }) => (
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
            <Icon size={14} strokeWidth={2} />
            <span className="flex-1 text-left">{label}</span>
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
            title="Club Info"
            description="Basic information about your club visible to members."
          >
            <Field label="Club Logo">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-[#f4f6f2] border border-[#e8ede4] flex items-center justify-center flex-shrink-0">
                  <Building2 size={24} className="text-[#6e7f65]" />
                </div>
                <button className="btn-secondary flex items-center gap-1.5 text-[13px]">
                  <Upload size={13} /> Upload Logo
                </button>
              </div>
            </Field>

            <Field label="Club Name">
              <input className="input" defaultValue={club.name} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input className="input" defaultValue={club.email ?? ""} />
              </Field>
              <Field label="Phone">
                <input className="input" defaultValue={club.phone ?? ""} />
              </Field>
            </div>

            <Field label="Address">
              <input className="input" defaultValue={club.address ?? ""} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <input className="input" defaultValue={club.city ?? ""} />
              </Field>
              <Field label="Country">
                <input className="input" defaultValue={club.country ?? ""} />
              </Field>
            </div>

            <Field label="Sports Offered">
              <div className="flex gap-2 flex-wrap">
                {SPORTS.map((sport) => (
                  <button
                    key={sport}
                    onClick={() => toggleSport(sport)}
                    className={`px-4 py-1.5 rounded-full text-[13px] border transition-all ${
                      sports.includes(sport)
                        ? "bg-[#e4f7b8] border-[#7aad12] text-[#2e4d03] font-medium"
                        : "bg-white border-[#d0d9c9] text-[#6e7f65] hover:border-[#7aad12]"
                    }`}
                  >
                    {sport}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Description">
              <textarea
                className="input resize-y"
                rows={3}
                defaultValue={club.description ?? ""}
              />
            </Field>

            <SaveButton />
          </Section>
        )}

        {/* Opening Hours */}
        {active === "hours" && (
          <Section
            title="Opening Hours"
            description="Set your club's operating hours for each day of the week."
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
                      <span className="text-[13px] text-[#6e7f65]">to</span>
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
                    <span className="text-[13px] text-[#6e7f65]">Closed</span>
                  )}
                </div>
              ))}
            </div>
            <SaveButton />
          </Section>
        )}

        {/* Booking Rules */}
        {active === "booking" && (
          <Section
            title="Booking Rules"
            description="Control how and when members can book courts."
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max advance booking (days)">
                <input className="input" type="number" defaultValue={14} />
              </Field>
              <Field label="Min booking duration (min)">
                <input className="input" type="number" defaultValue={60} />
              </Field>
              <Field label="Max booking duration (min)">
                <input className="input" type="number" defaultValue={120} />
              </Field>
              <Field label="Cancellation window (hours)">
                <input className="input" type="number" defaultValue={24} />
              </Field>
              <Field label="Max bookings per member per day">
                <input className="input" type="number" defaultValue={2} />
              </Field>
              <Field label="Slot interval (min)">
                <select className="input">
                  <option>30</option>
                  <option>60</option>
                  <option>90</option>
                </select>
              </Field>
            </div>

            <Field label="Booking requires approval">
              <div className="flex flex-col gap-2">
                {[
                  "Never — instant confirmation",
                  "Always — admin must approve",
                  "Only for guests",
                ].map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2.5 cursor-pointer text-[13px] text-[#3d4f35]"
                  >
                    <input
                      type="radio"
                      name="approval"
                      defaultChecked={opt.startsWith("Never")}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Walk-in bookings">
              <Toggle
                label="Allow walk-in bookings without an account"
                defaultChecked
              />
            </Field>

            <Field label="Guest bookings">
              <Toggle label="Allow members to bring guests" defaultChecked />
            </Field>

            <SaveButton />
          </Section>
        )}

        {/* Payments */}
        {active === "payments" && (
          <Section
            title="Payments"
            description="Configure pricing, currency and payment methods."
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency">
                <select className="input">
                  <option>EUR — €</option>
                  <option>USD — $</option>
                  <option>MKD — ден</option>
                  <option>GBP — £</option>
                </select>
              </Field>
              <Field label="Tax rate (%)">
                <input className="input" type="number" defaultValue={18} />
              </Field>
            </div>

            <Field label="Stripe Integration">
              <div className="flex items-center justify-between p-4 bg-[#f4f6f2] border border-[#e8ede4] rounded-xl">
                <div>
                  <p className="text-[13px] font-medium text-[#111c0a]">
                    Stripe
                  </p>
                  <p className="text-[12px] text-[#6e7f65] mt-0.5">
                    Not connected
                  </p>
                </div>
                <button className="btn-primary text-[13px]">
                  Connect Stripe
                </button>
              </div>
            </Field>

            <Field label="Online payments">
              <Toggle
                label="Require payment at time of booking"
                defaultChecked
              />
            </Field>

            <Field label="Refunds">
              <Toggle
                label="Allow automatic refunds on cancellation within window"
                defaultChecked
              />
            </Field>

            <SaveButton />
          </Section>
        )}

        {/* Notifications */}
        {active === "notifications" && (
          <Section
            title="Notifications"
            description="Choose which email notifications are sent automatically."
          >
            <div className="flex flex-col divide-y divide-[#e8ede4]">
              {[
                {
                  label: "Booking confirmed",
                  sub: "Sent to member when a booking is confirmed",
                },
                {
                  label: "Booking cancelled",
                  sub: "Sent when a booking is cancelled by either party",
                },
                {
                  label: "Booking reminder",
                  sub: "Sent 24h before the booking starts",
                },
                {
                  label: "New member joined",
                  sub: "Sent to admin when a new member registers",
                },
                {
                  label: "Payment received",
                  sub: "Sent to member after successful payment",
                },
                {
                  label: "Cancellation refund issued",
                  sub: "Sent when a refund is processed",
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
            <Field label="Reply-to email">
              <input className="input" defaultValue={club.email ?? ""} />
            </Field>
            <SaveButton />
          </Section>
        )}

        {/* Danger Zone */}
        {active === "danger" && (
          <Section
            title="Danger Zone"
            description="Irreversible actions. Proceed with caution."
          >
            <DangerCard
              title="Export all data"
              description="Download a full export of your club data including bookings, members, and payments."
              action="Export Data"
              variant="default"
            />
            <DangerCard
              title="Clear all bookings"
              description="Permanently delete all booking history. This cannot be undone."
              action="Clear Bookings"
              variant="warning"
            />
            <DangerCard
              title="Delete club"
              description="Permanently delete your club and all associated data. This action is irreversible."
              action="Delete Club"
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
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#e8ede4] rounded-2xl p-7">
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

function SaveButton() {
  return (
    <div className="pt-2">
      <button className="btn-primary flex items-center gap-1.5 text-[13px]">
        <Save size={13} /> Save Changes
      </button>
    </div>
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
