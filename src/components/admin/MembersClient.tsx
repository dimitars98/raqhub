"use client";

import { dateLocale } from "@/lib/dateLocale";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { addMonths, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { ChevronDown, Download, Mail, RotateCw, Search, X } from "lucide-react";
import type { Member, MembershipPlan, MemberStatus } from "@/types/database";
import Modal from "@/components/ui/Modal";
import FilterSelect from "@/components/ui/FilterSelect";
import SubmitButton from "../ui/SubmitButton";
import { useLabels } from "@/hooks/useLabels";
import { useClickOutside } from "@/hooks/useClickOutside";
import { BADGE, memberStatusTone } from "@/lib/badges";
import { MEMBER_STATUSES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import { toCsv } from "@/lib/csv";
import { useReadOnly } from "@/components/admin/ReadOnly";
import SelectField from "@/components/ui/SelectField";
import { CancelActionButton, EditButton } from "@/components/ui/ActionButton";

export type MemberWithPlan = Member & { plan?: MembershipPlan | null };

type FormValues = {
  full_name: string;
  email: string;
  phone: string;
  plan_id: string;
  ends_at: string;
  notes: string;
  status: MemberStatus;
};

interface Props {
  members: MemberWithPlan[];
  plans: MembershipPlan[];
  clubId: string;
  /** Status tab to open first, e.g. "ending". */
  initialTab?: string;
}

type Tab = "all" | "active" | "ending" | "expired" | "cancelled";
const TABS: Tab[] = ["all", "active", "ending", "expired", "cancelled"];
const PER_PAGE = [25, 50, 100];
const EXTEND_MONTHS = [1, 3, 12];
/** Within this many days the end date shows in amber and counts as "ending soon". */
const SOON_DAYS = 30;
const PLAN_SELECT = "*, plan:membership_plans(id, name, price, billing_period)";
/** Longest mailto: link most mail apps still open. */
const MAILTO_LIMIT = 1900;

/** `ends_at` is a date ("2026-11-02"); read it as a local day. */
const endDate = (m: Member) => (m.ends_at ? parseISO(m.ends_at.slice(0, 10)) : null);

/** A small menu that opens under its button and closes on a click elsewhere. */
function Dropdown({
  label,
  icon,
  open,
  onToggle,
  onClose,
  tone = "dark",
  mobileBottom = 0,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  tone?: "dark" | "lime";
  /** On a phone the menu opens full width, this far above the bottom. */
  mobileBottom?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open ? onClose : () => {});
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={tone === "lime" ? BAR_BUTTON_LIME : BAR_BUTTON}
      >
        {icon}
        {label}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div
          style={{ "--menu-bottom": `${mobileBottom}px` } as React.CSSProperties}
          className="fixed inset-x-3 bottom-[var(--menu-bottom)] z-40 flex flex-col rounded-2xl border border-[#e8ede4] bg-white p-1.5 text-[#111c0a] shadow-[0_20px_40px_-20px_rgba(17,28,10,0.45)] md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:mt-2 md:w-60"
        >
          {children}
        </div>
      )}
    </div>
  );
}

const BAR_BUTTON =
  "inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[13px] text-white transition-colors hover:bg-white/20 disabled:opacity-50";
const BAR_BUTTON_LIME =
  "inline-flex items-center gap-1.5 rounded-xl bg-[#a8d832] px-3 py-2 text-[13px] font-semibold text-[#111c0a] transition-colors hover:bg-[#bde65a] disabled:opacity-50";
const MENU_ITEM =
  "rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-[#f3fbde] disabled:opacity-50";
export default function MembersClient({
  members: initial,
  plans,
  initialTab,
}: Props) {
  const dfLocale = dateLocale(useLocale());
  const [members, setMembers] = useState(initial);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MemberWithPlan | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>(
    TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "all",
  );
  const [planFilter, setPlanFilter] = useState("all");
  const [endsWithin, setEndsWithin] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<"extend" | "plan" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  // Height of the selection bar, so a menu opened from it on a phone sits just above it.
  const bar = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  const t = useTranslations("members");
  const { readOnly, hint } = useReadOnly();
  const te = useTranslations("export");
  const labels = useLabels();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      plan_id: "",
      ends_at: "",
      notes: "",
      status: "active",
    },
  });

  const today = startOfDay(new Date());
  const daysLeft = (m: Member) => {
    const end = endDate(m);
    return end ? differenceInCalendarDays(end, today) : null;
  };
  const isEndingSoon = (m: Member) => {
    const d = daysLeft(m);
    return m.status === "active" && d !== null && d >= 0 && d <= SOON_DAYS;
  };
  const inTab = (m: Member, which: Tab) =>
    which === "all" ? true : which === "ending" ? isEndingSoon(m) : m.status === which;

  const counts = Object.fromEntries(
    TABS.map((tb) => [tb, members.filter((m) => inTab(m, tb)).length]),
  ) as Record<Tab, number>;

  const q = search.trim().toLowerCase();
  const filtered = members
    .filter((m) => inTab(m, tab))
    .filter((m) =>
      planFilter === "all" ? true : planFilter === "none" ? !m.plan_id : m.plan_id === planFilter,
    )
    .filter((m) => {
      if (!endsWithin) return true;
      const d = daysLeft(m);
      return d !== null && d >= 0 && d <= endsWithin;
    })
    .filter(
      (m) =>
        !q ||
        m.full_name.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.phone?.replace(/\s/g, "").includes(q.replace(/\s/g, "")),
    );
  // "Ending soon" is a to-do list: soonest first.
  if (tab === "ending") filtered.sort((a, b) => (daysLeft(a) ?? 0) - (daysLeft(b) ?? 0));

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * perPage, current * perPage + perPage);
  const allOnPage = rows.length > 0 && rows.every((m) => selected.has(m.id));
  const someOnPage = rows.some((m) => selected.has(m.id));
  const chosen = members.filter((m) => selected.has(m.id));

  const headerBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerBox.current) headerBox.current.indeterminate = someOnPage && !allOnPage;
  }, [someOnPage, allOnPage]);

  // Any filter change starts again at page 1.
  const refilter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of rows) {
        if (allOnPage) next.delete(m.id);
        else next.add(m.id);
      }
      return next;
    });
  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setMenu(null);
    setConfirmCancel(false);
  }, []);

  useEffect(() => {
    if (menu && bar.current) setBarHeight(bar.current.offsetHeight);
  }, [menu]);

  // Escape clears the selection, like most list apps.
  useEffect(() => {
    if (!selected.size) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showModal) clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size, showModal, clearSelection]);

  const replace = (updated: MemberWithPlan[]) => {
    const byId = new Map(updated.map((m) => [m.id, m]));
    setMembers((prev) => prev.map((m) => byId.get(m.id) ?? m));
  };

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    setNotice(null);
    setMenu(null);
    try {
      setNotice({ ok: true, text: await work() });
      clearSelection();
    } catch (e) {
      console.error("[members bulk]", e);
      setNotice({ ok: false, text: t("bulk.failed") });
    } finally {
      setBusy(false);
    }
  };

  const extend = (months: number) =>
    run(async () => {
      const supabase = createClient();
      const results = await Promise.all(
        chosen.map((m) => {
          const end = endDate(m);
          // From the current end date, or from today if it has already passed.
          const from = end && end >= today ? end : today;
          return supabase
            .from("members")
            .update({ ends_at: format(addMonths(from, months), "yyyy-MM-dd"), status: "active" })
            .eq("id", m.id)
            .select(PLAN_SELECT)
            .single();
        }),
      );
      const failed = results.find((r) => r.error);
      replace(results.flatMap((r) => (r.data ? [r.data as unknown as MemberWithPlan] : [])));
      if (failed) throw failed.error;
      return t("bulk.extended", { n: results.length });
    });

  const changePlan = (planId: string | null) =>
    run(async () => {
      const { data, error } = await createClient()
        .from("members")
        .update({ plan_id: planId })
        .in("id", chosen.map((m) => m.id))
        .select(PLAN_SELECT);
      if (error) throw error;
      replace((data ?? []) as unknown as MemberWithPlan[]);
      return t("bulk.planChanged", { n: data?.length ?? 0 });
    });

  const cancelMany = () =>
    run(async () => {
      const { data, error } = await createClient()
        .from("members")
        .update({ status: "cancelled" })
        .in("id", chosen.map((m) => m.id))
        .select(PLAN_SELECT);
      if (error) throw error;
      replace((data ?? []) as unknown as MemberWithPlan[]);
      return t("bulk.cancelled", { n: data?.length ?? 0 });
    });

  /** Opens the mail app with everyone in BCC, or copies the addresses if there are too many. */
  const emailSelected = async () => {
    setMenu(null);
    const emails = [...new Set(chosen.flatMap((m) => (m.email ? [m.email.trim()] : [])))];
    const missing = chosen.length - chosen.filter((m) => m.email).length;
    if (!emails.length) {
      setNotice({ ok: false, text: t("bulk.noEmails") });
      return;
    }
    const link = `mailto:?bcc=${emails.map(encodeURIComponent).join(",")}`;
    const skipped = missing ? ` ${t("bulk.withoutEmail", { n: missing })}` : "";
    if (link.length <= MAILTO_LIMIT) {
      window.location.assign(link);
      setNotice({ ok: true, text: t("bulk.emailOpened", { n: emails.length }) + skipped });
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setNotice({ ok: true, text: t("bulk.emailsCopied", { n: emails.length }) + skipped });
    } catch {
      setNotice({ ok: false, text: t("bulk.failed") });
    }
  };

  /** Downloads the given members as a spreadsheet, like Settings → Your data. */
  const exportCsv = (list: MemberWithPlan[]) => {
    const csv = toCsv(
      [te("name"), te("email"), te("phone"), te("plan"), te("status"), te("memberSince"), te("ends"), te("notes")],
      list.map((m) => [
        m.full_name,
        m.email,
        m.phone,
        m.plan?.name,
        labels.memberStatus(m.status),
        m.starts_at?.slice(0, 10),
        m.ends_at?.slice(0, 10),
        m.notes,
      ]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `members-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAdd = () => {
    setEditing(null);
    reset({
      full_name: "",
      email: "",
      phone: "",
      plan_id: "",
      ends_at: "",
      notes: "",
      status: "active",
    });
    setShowModal(true);
  };

  const openEdit = (m: MemberWithPlan) => {
    setEditing(m);
    reset({
      full_name: m.full_name,
      email: m.email ?? "",
      phone: m.phone ?? "",
      plan_id: m.plan_id ?? "",
      ends_at: m.ends_at ? format(new Date(m.ends_at), "yyyy-MM-dd") : "",
      notes: m.notes ?? "",
      status: m.status,
    });
    setShowModal(true);
  };

  const onSubmit = async (values: FormValues) => {
    const payload = {
      full_name: values.full_name,
      email: values.email || null,
      phone: values.phone || null,
      plan_id: values.plan_id || null,
      ends_at: values.ends_at || null,
      notes: values.notes || null,
      status: values.status,
    };

    try {
      const res = await fetch("/api/members", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409 && (data?.field === "email" || data?.field === "phone")) {
        const field = data.field as "email" | "phone";
        setError(field, {
          type: "manual",
          message: t(field === "email" ? "errors.duplicateEmail" : "errors.duplicatePhone"),
        });
        return;
      }
      if (!res.ok || !data) throw new Error(`members ${res.status}`);

      if (editing) setMembers((prev) => prev.map((m) => (m.id === editing.id ? data : m)));
      else setMembers((prev) => [data, ...prev]);
      setShowModal(false);
    } catch (e) {
      console.error("[members] save", e);
      setError("root", { type: "manual", message: readOnly && hint ? hint : t("errors.saveFailed") });
    }
  };

  const handleCancel = async (id: string) => {
    setNotice(null);
    try {
      const res = await fetch("/api/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(`members ${res.status}`);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: "cancelled" as MemberStatus } : m,
        ),
      );
    } catch (e) {
      console.error("[members] cancel", e);
      setNotice({ ok: false, text: readOnly && hint ? hint : t("errors.cancelFailed") });
    }
  };

  /** "in 12 days" / "9 days ago", amber when it ends within a month. */
  const endsNote = (m: Member) => {
    const d = daysLeft(m);
    if (d === null || m.status === "cancelled") return null;
    if (d < 0) return { text: t("daysAgo", { n: -d }), soon: false };
    return { text: t("inDays", { n: d }), soon: d <= SOON_DAYS && m.status === "active" };
  };
  const endsText = (m: Member) => {
    const end = endDate(m);
    return end ? format(end, "d MMM yyyy", { locale: dfLocale }) : "—";
  };
  const planText = (m: MemberWithPlan) =>
    m.plan ? `€${m.plan.price} ${labels.billingPeriod(m.plan.billing_period)}` : "";

  const n = selected.size;
  const from = filtered.length ? current * perPage + 1 : 0;
  const to = current * perPage + rows.length;

  return (
    <div className={n ? "pb-40 md:pb-0" : undefined}>
      {/* Title */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111c0a]">
            {t("title")} <span className="font-semibold text-[#6e7f65]">{members.length}</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            disabled={!filtered.length}
            className="btn-secondary inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download size={14} aria-hidden="true" /> {t("export")}
          </button>
          <button onClick={openAdd} disabled={readOnly} title={hint} className="btn-primary">
            {t("addMember")}
          </button>
        </div>
      </div>

      {/* Status tabs with counts */}
      <div
        role="tablist"
        aria-label={t("columns.status")}
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        {TABS.map((tb) => {
          const on = tab === tb;
          const soon = tb === "ending";
          return (
            <button
              key={tb}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => refilter(setTab)(tb)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] transition-colors ${
                on
                  ? "border-[#111c0a] bg-[#111c0a] font-semibold text-white"
                  : soon && counts.ending
                    ? "border-[#fde68a] bg-[#fffbeb] text-[#92400e] hover:border-[#f5c94b]"
                    : "border-[#e8ede4] bg-white text-[#3d4f35] hover:border-[#d0d9c9]"
              }`}
            >
              {t(`tabs.${tb}`)}
              <span className={`ml-1.5 ${on ? "opacity-70" : soon && counts.ending ? "font-bold" : "text-[#6e7f65]"}`}>
                {counts[tb]}
              </span>
            </button>
          );
        })}
      </div>

      {notice && (
        <div
          role="status"
          className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.ok
              ? "border-[#d6f09a] bg-[#f3fbde] text-[#2e4d03]"
              : "border-[#fecaca] bg-[#fff5f5] text-[#b91c1c]"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label={t("bulk.dismiss")}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#e8ede4] bg-white md:overflow-visible">
        {/* Selection bar: at the top of the list on a computer, at the bottom of the screen on a phone */}
        {n > 0 && (
          <div ref={bar} className="fixed inset-x-3 bottom-3 z-30 flex flex-col gap-2 rounded-2xl bg-[#111c0a] p-3 text-white shadow-[0_20px_40px_-16px_rgba(17,28,10,0.6)] md:static md:flex-row md:flex-wrap md:items-center md:rounded-none md:rounded-t-2xl md:px-5 md:py-2.5 md:shadow-none">
            <div className="flex items-center justify-between gap-3 md:mr-3">
              <span className="text-[13px] font-semibold">{t("bulk.selected", { n })}</span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-[13px] text-[#c9d4c1] underline underline-offset-[3px] md:hidden"
              >
                {t("bulk.clear")}
              </button>
            </div>

            {confirmCancel ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px]">{t("bulk.confirmCancel", { n })}</span>
                <button
                  type="button"
                  onClick={cancelMany}
                  disabled={busy}
                  className="rounded-xl bg-[#fecaca] px-3 py-2 text-[13px] font-semibold text-[#7f1d1d] hover:bg-white disabled:opacity-50"
                >
                  {t("bulk.confirmYes")}
                </button>
                <button type="button" onClick={() => setConfirmCancel(false)} className={BAR_BUTTON}>
                  {t("bulk.confirmNo")}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={emailSelected} disabled={busy} className={BAR_BUTTON}>
                  <Mail size={14} className="text-[#a8d832]" aria-hidden="true" /> {t("bulk.email")}
                </button>
                <button type="button" onClick={() => exportCsv(chosen)} disabled={busy} className={BAR_BUTTON}>
                  <Download size={14} className="text-[#a8d832]" aria-hidden="true" /> {t("export")}
                </button>
                <Dropdown
                  label={t("bulk.extend")}
                  icon={<RotateCw size={14} aria-hidden="true" />}
                  tone="lime"
                  open={menu === "extend"}
                  onToggle={() => setMenu(menu === "extend" ? null : "extend")}
                  onClose={() => setMenu(null)}
                  mobileBottom={barHeight + 20}
                >
                  {EXTEND_MONTHS.map((months) => (
                    <button
                      key={months}
                      type="button"
                      disabled={busy || readOnly}
                      onClick={() => extend(months)}
                      className={MENU_ITEM}
                    >
                      {t("bulk.extendBy", { months })}
                    </button>
                  ))}
                  <span className="mx-1.5 my-1 h-px bg-[#e8ede4]" />
                  <span className="px-3 pb-1.5 pt-1 text-xs leading-relaxed text-[#55664c]">
                    {t("bulk.extendHint")}
                  </span>
                </Dropdown>
                <Dropdown
                  label={t("bulk.changePlan")}
                  icon={null}
                  open={menu === "plan"}
                  onToggle={() => setMenu(menu === "plan" ? null : "plan")}
                  onClose={() => setMenu(null)}
                  mobileBottom={barHeight + 20}
                >
                  {plans.map((p) => (
                    <button key={p.id} type="button" disabled={busy || readOnly} onClick={() => changePlan(p.id)} className={MENU_ITEM}>
                      <span className="block font-medium">{p.name}</span>
                      <span className="block text-xs text-[#55664c]">
                        €{p.price} {labels.billingPeriod(p.billing_period)}
                      </span>
                    </button>
                  ))}
                  <button type="button" disabled={busy || readOnly} onClick={() => changePlan(null)} className={MENU_ITEM}>
                    {t("modal.noPlan")}
                  </button>
                </Dropdown>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(null);
                    setConfirmCancel(true);
                  }}
                  disabled={busy || readOnly}
                  title={hint}
                  className={`${BAR_BUTTON} text-[#fecaca]`}
                >
                  {t("bulk.cancel")}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto hidden text-[13px] text-[#c9d4c1] underline underline-offset-[3px] hover:text-white md:block"
            >
              {t("bulk.clear")}
            </button>
          </div>
        )}

        {/* Filters */}
        <div className={`flex flex-wrap items-center gap-2 border-b border-[#e8ede4] bg-[#fbfcfa] px-4 py-3 md:px-5 ${n ? "" : "md:rounded-t-2xl"}`}>
          <label className="flex h-10 min-w-0 flex-[1_1_240px] items-center gap-2 rounded-xl border border-[#d0d9c9] bg-white px-3 text-[13px]">
            <Search size={15} className="shrink-0 text-[#6e7f65]" aria-hidden="true" />
            <input
              type="search"
              aria-label={t("searchPlaceholder")}
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => refilter(setSearch)(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[#111c0a] outline-none placeholder:text-[#6e7f65]"
            />
          </label>
          <FilterSelect
            label={t("filters.plan")}
            value={planFilter}
            onChange={refilter(setPlanFilter)}
            options={[
              { value: "all", label: t("filters.allPlans") },
              ...plans.map((p) => ({ value: p.id, label: p.name })),
              { value: "none", label: t("modal.noPlan") },
            ]}
          />
          <FilterSelect
            label={t("filters.ends")}
            value={String(endsWithin)}
            onChange={(v) => refilter(setEndsWithin)(Number(v))}
            options={[
              { value: "0", label: t("filters.anyTime") },
              { value: "30", label: t("filters.within", { days: 30 }) },
              { value: "90", label: t("filters.within", { days: 90 }) },
            ]}
          />
          <FilterSelect
            label={t("filters.show")}
            value={String(perPage)}
            onChange={(v) => refilter(setPerPage)(Number(v))}
            options={PER_PAGE.map((n) => ({ value: String(n), label: String(n) }))}
            align="end"
            className="md:ml-auto"
          />
        </div>

        {!rows.length ? (
          <p className="px-5 py-12 text-center text-sm text-[#6e7f65]">
            {members.length ? t("noResults") : t("noMembers")}
          </p>
        ) : (
          <>
            {/* Phone: one card per member */}
            <ul className="divide-y divide-[#e8ede4] md:hidden">
              {rows.map((m) => {
                const note = endsNote(m);
                const on = selected.has(m.id);
                return (
                  <li key={m.id} className={`flex items-center gap-3 px-4 py-3.5 ${on ? "bg-[#f6fbe9]" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(m.id)}
                      aria-label={t("bulk.selectRow", { name: m.full_name })}
                      className="size-5 shrink-0 accent-[#7aad12]"
                    />
                    <button type="button" onClick={() => openEdit(m)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-[#111c0a]">{m.full_name}</span>
                        <span className={`${BADGE} shrink-0 ${memberStatusTone(m.status)}`}>{labels.memberStatus(m.status)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[#55664c]">
                        {[m.plan?.name, endDate(m) ? endsText(m) : null].filter(Boolean).join(" · ") || "—"}
                        {note && (
                          <span className={note.soon ? " font-semibold text-[#b45309]" : ""}> · {note.text}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Computer: the table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#55664c]">
                    <th className="w-12 py-3 pl-5 font-medium">
                      <input
                        ref={headerBox}
                        type="checkbox"
                        checked={allOnPage}
                        onChange={togglePage}
                        aria-label={t("bulk.selectPage")}
                        className="size-[18px] accent-[#7aad12]"
                      />
                    </th>
                    <th className="px-3 py-3 font-medium">{t("columns.member")}</th>
                    <th className="px-3 py-3 font-medium">{t("columns.plan")}</th>
                    <th className="px-3 py-3 font-medium">{t("columns.status")}</th>
                    <th className="px-3 py-3 font-medium">{t("columns.expires")}</th>
                    <th className="py-3 pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => {
                    const note = endsNote(m);
                    const on = selected.has(m.id);
                    return (
                      <tr
                        key={m.id}
                        className={`border-t border-[#e8ede4] transition-colors ${on ? "bg-[#f6fbe9]" : "hover:bg-[#f8f9f7]"}`}
                      >
                        <td className="py-3 pl-5">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(m.id)}
                            aria-label={t("bulk.selectRow", { name: m.full_name })}
                            className="size-[18px] accent-[#7aad12]"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-[#111c0a]">{m.full_name}</div>
                          <div className="max-w-[260px] truncate text-xs text-[#55664c]">
                            {m.email ?? m.phone ?? "—"}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {m.plan ? (
                            <>
                              <div className="text-[#3d4f35]">{m.plan.name}</div>
                              <div className="text-xs text-[#55664c]">{planText(m)}</div>
                            </>
                          ) : (
                            <span className="text-[#6e7f65]">{t("modal.noPlan")}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`${BADGE} ${memberStatusTone(m.status)}`}>
                            {labels.memberStatus(m.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-[#3d4f35]">{endsText(m)}</div>
                          {note && (
                            <div className={`text-xs ${note.soon ? "font-semibold text-[#b45309]" : "text-[#55664c]"}`}>
                              {note.text}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-5">
                          <div className="flex items-center justify-end gap-2">
                            <EditButton onClick={() => openEdit(m)}>{t("actions.edit")}</EditButton>
                            {m.status === "active" && (
                              <CancelActionButton title={hint} disabled={readOnly} onClick={() => handleCancel(m.id)}>
                                {t("actions.cancel")}
                              </CancelActionButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pages */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8ede4] px-4 py-3 text-[13px] text-[#55664c] md:px-5">
            <span>{t("showing", { from, to, total: filtered.length })}</span>
            {pages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage(current - 1)}
                  disabled={current === 0}
                  aria-label={t("prevPage")}
                  className="grid size-9 place-items-center rounded-lg border border-[#e8ede4] bg-white text-[#111c0a] disabled:text-[#c9d4c1]"
                >
                  ‹
                </button>
                <span className="px-2 tabular-nums">
                  {current + 1} / {pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(current + 1)}
                  disabled={current >= pages - 1}
                  aria-label={t("nextPage")}
                  className="grid size-9 place-items-center rounded-lg border border-[#e8ede4] bg-white text-[#111c0a] disabled:text-[#c9d4c1]"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <Modal.Content>
          <Modal.Header>
            {editing ? t("modal.editTitle") : t("modal.addTitle")}
          </Modal.Header>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Modal.Body>
              <Modal.Field label={t("modal.fullName")} htmlFor="member-name" required>
                <input
                  id="member-name"
                  aria-invalid={!!errors.full_name}
                  className="input"
                  placeholder={t("modal.fullNamePlaceholder")}
                  {...register("full_name", {
                    required: t("modal.fullNameRequired"),
                  })}
                />
                {errors.full_name && (
                  <p role="alert" className="text-xs text-red-500 mt-1">
                    {errors.full_name.message}
                  </p>
                )}
              </Modal.Field>
              <Modal.Grid>
                <Modal.Field label={t("modal.email")} htmlFor="member-email">
                  <input
                    id="member-email"
                    aria-invalid={!!errors.email}
                    className="input"
                    type="email"
                    placeholder={t("modal.emailPlaceholder")}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p role="alert" className="text-xs text-red-500 mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </Modal.Field>
                <Modal.Field label={t("modal.phone")} htmlFor="member-phone">
                  <input
                    id="member-phone"
                    aria-invalid={!!errors.phone}
                    className="input"
                    placeholder={t("modal.phonePlaceholder")}
                    {...register("phone")}
                  />
                  {errors.phone && (
                    <p role="alert" className="text-xs text-red-500 mt-1">
                      {errors.phone.message}
                    </p>
                  )}
                </Modal.Field>
              </Modal.Grid>
              <Modal.Grid>
                <Modal.Field label={t("modal.plan")} htmlFor="member-plan">
                  <Controller
                    name="plan_id"
                    control={control}
                    render={({ field }) => (
                      <SelectField
                        id="member-plan"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        options={[
                          { value: "", label: t("modal.noPlan") },
                          ...plans.map((p) => ({ value: p.id, label: `${p.name} — €${p.price}` })),
                        ]}
                      />
                    )}
                  />
                </Modal.Field>
                <Modal.Field label={t("modal.expires")} htmlFor="member-ends">
                  <input
                    id="member-ends"
                    className="input"
                    type="date"
                    {...register("ends_at")}
                  />
                </Modal.Field>
              </Modal.Grid>
              {editing && (
                <Modal.Field label={t("modal.status")} htmlFor="member-status">
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <SelectField
                        id="member-status"
                        value={field.value}
                        onChange={field.onChange}
                        options={MEMBER_STATUSES.map((s) => ({ value: s, label: labels.memberStatus(s) }))}
                      />
                    )}
                  />
                </Modal.Field>
              )}
              <Modal.Field label={t("modal.notes")} htmlFor="member-notes">
                <textarea
                  id="member-notes"
                  className="input resize-none"
                  rows={2}
                  placeholder={t("modal.notesPlaceholder")}
                  {...register("notes")}
                />
              </Modal.Field>
              {readOnly && (
                <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-sm text-ink-600">{hint}</p>
              )}
              {errors.root && (
                <p role="alert" className="rounded-xl bg-[#fff5f5] px-3 py-2.5 text-sm text-[#b91c1c]">
                  {errors.root.message}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary flex-1"
              >
                {t("modal.cancelBtn")}
              </button>
              <SubmitButton
                label={editing ? t("modal.saveBtn") : t("modal.addBtn")}
                loadingLabel={t("modal.saving")}
                pending={isSubmitting}
                disabled={readOnly}
                className="flex-1"
              />
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal>
    </div>
  );
}
