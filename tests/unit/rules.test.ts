// Small rules the app relies on: safe redirects, CSV export, payment mode,
// booking rules and the club's plan (trial, grace, read-only).
import { describe, expect, it } from "vitest";
import { getSafeRedirect } from "@/lib/safeRedirect";
import { toCsv } from "@/lib/csv";
import { payModeOf } from "@/lib/paymentMode";
import { DEFAULT_RULES, canCancel, normalizeRules, validateRules } from "@/lib/bookingRules";
import { GRACE_DAYS, clubAccess } from "@/lib/plans";

describe("getSafeRedirect", () => {
  it("follows paths inside the site", () => {
    expect(getSafeRedirect("/matches/123")).toBe("/matches/123");
  });
  it("refuses anything that could lead to another site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "", null]) {
      expect(getSafeRedirect(bad)).toBeNull();
    }
  });
});

describe("toCsv", () => {
  const body = (csv: string) => csv.replace(/^﻿/, "");

  it("starts with a byte-order mark so Excel reads Cyrillic", () => {
    expect(toCsv(["Име"], [["Бојан"]]).charCodeAt(0)).toBe(0xfeff);
  });
  it("quotes commas, quotes and new lines", () => {
    expect(body(toCsv(["a"], [['Say "hi", ok']]))).toBe('a\r\n"Say ""hi"", ok"\r\n');
  });
  it("stops spreadsheet formulas from running", () => {
    expect(body(toCsv(["a"], [["=HYPERLINK(\"x\")"]]))).toBe('a\r\n"\'=HYPERLINK(""x"")"\r\n');
    expect(body(toCsv(["a"], [["-5"], [-5]]))).toBe("a\r\n'-5\r\n-5\r\n");
  });
  it("leaves empty cells empty", () => {
    expect(body(toCsv(["a", "b"], [[null, undefined]]))).toBe("a,b\r\n,\r\n");
  });
});

describe("payModeOf", () => {
  it("is pay-at-club until Stripe is ready", () => {
    expect(payModeOf(null)).toBe("club");
    expect(payModeOf({ payment_mode: "online", stripe_charges_enabled: false })).toBe("club");
  });
  it("follows the club's choice once Stripe is ready", () => {
    expect(payModeOf({ payment_mode: "online", stripe_charges_enabled: true })).toBe("online");
    expect(payModeOf({ payment_mode: "either", stripe_charges_enabled: true })).toBe("either");
    expect(payModeOf({ payment_mode: "nonsense", stripe_charges_enabled: true })).toBe("club");
  });
});

describe("booking rules", () => {
  it("fills in defaults for anything missing or broken", () => {
    expect(normalizeRules(null)).toEqual(DEFAULT_RULES);
    expect(normalizeRules({ durations: [45, 60], cancel_hours: "x" }).durations).toEqual([60]);
  });
  it("rejects values the settings don't offer", () => {
    expect(validateRules(DEFAULT_RULES)).toBeNull();
    expect(validateRules({ ...DEFAULT_RULES, durations: [] })).toBe("durations");
    expect(validateRules({ ...DEFAULT_RULES, max_days_ahead: 400 })).toBe("daysAhead");
    expect(validateRules({ ...DEFAULT_RULES, cancel_hours: 5 })).toBe("cancelDeadline");
  });
  it("allows cancelling only before the deadline", () => {
    const now = new Date("2026-10-28T10:00:00Z");
    const rules = { ...DEFAULT_RULES, cancel_hours: 24 };
    expect(canCancel("2026-10-29T11:00:00Z", rules, now)).toBe(true);
    expect(canCancel("2026-10-29T09:00:00Z", rules, now)).toBe(false);
  });
});

describe("clubAccess", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const days = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

  it("gives everything during the free trial", () => {
    const a = clubAccess({ plan: "starter", trial_ends_at: days(10), paid_until: null }, now);
    expect(a.status).toBe("trial");
    expect(a.trialDaysLeft).toBe(10);
    expect(a.maxCourts).toBeNull();
    expect(a.readOnly).toBe(false);
  });

  it("keeps working for a few days after the trial, then becomes read-only", () => {
    const grace = clubAccess({ plan: "club", trial_ends_at: days(-1), paid_until: null }, now);
    expect(grace.status).toBe("grace");
    expect(grace.readOnly).toBe(false);
    const locked = clubAccess({ plan: "club", trial_ends_at: days(-(GRACE_DAYS + 1)), paid_until: null }, now);
    expect(locked.status).toBe("locked");
    expect(locked.readOnly).toBe(true);
  });

  it("counts a paid date as paid through the end of that day", () => {
    const a = clubAccess({ plan: "club", trial_ends_at: days(-40), paid_until: "2026-10-28" }, now);
    expect(a.status).toBe("active");
  });
});
