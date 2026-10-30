"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Check, Mail, UserPlus, Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import { inviteStaff, removeStaff } from "@/app/[locale]/admin/staff/actions";
import { BADGE, NEUTRAL_TONE } from "@/lib/badges";
import { dateLocale } from "@/lib/dateLocale";
import { useReadOnly } from "@/components/admin/ReadOnly";
import { DeleteButton } from "@/components/ui/ActionButton";

export type StaffRow = {
  id: string;
  email: string;
  /** Their name, once they have signed in. */
  name: string | null;
  /** Signed in with the invited email (otherwise still invited). */
  active: boolean;
  /** When they joined, or when they were invited. */
  since: string;
};

export default function StaffClient({ staff }: { staff: StaffRow[] }) {
  const t = useTranslations("staff");
  const { readOnly, hint } = useReadOnly();
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<StaffRow | null>(null);
  const [pending, start] = useTransition();

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await inviteStaff(email);
      if (result.error) {
        setMessage({ ok: false, text: t(`errors.${result.error}`) });
        return;
      }
      setMessage({
        ok: true,
        text: result.emailSent
          ? t("invited", { email: email.trim().toLowerCase() })
          : t("invitedNoEmail", { email: email.trim().toLowerCase() }),
      });
      setEmail("");
    });
  };

  const remove = (row: StaffRow) => {
    setRemoving(null);
    start(async () => {
      const result = await removeStaff(row.id);
      if (result.error) setMessage({ ok: false, text: t("errors.failed") });
    });
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-400">{t("subtitle")}</p>
      </div>

      {/* What staff can and can't do */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink-100 bg-white p-5">
          <p className="mb-2 text-sm font-semibold text-ink-900">{t("canTitle")}</p>
          <ul className="space-y-1.5 text-sm text-ink-600">
            {(t.raw("can") as string[]).map((line) => (
              <li key={line} className="flex gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-5">
          <p className="mb-2 text-sm font-semibold text-ink-900">{t("ownerOnlyTitle")}</p>
          <p className="text-sm text-ink-600">{t("ownerOnly")}</p>
        </div>
      </div>

      {/* Invite */}
      <form onSubmit={invite} className="mb-6 rounded-2xl border border-ink-100 bg-white p-5">
        <label htmlFor="staff-email" className="mb-1.5 block text-sm font-semibold text-ink-900">
          {t("inviteTitle")}
        </label>
        <p className="mb-3 text-sm text-ink-400">{t("inviteHint")}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="staff-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="input flex-1"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={readOnly || pending}
            title={hint}
            className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <UserPlus size={16} aria-hidden="true" />
            {pending ? t("sending") : t("invite")}
          </button>
        </div>
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${
              message.ok ? "bg-brand-100 text-brand-900" : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </p>
        )}
      </form>

      {/* The list */}
      {staff.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white px-6 py-12 text-center">
          <Users size={28} className="mx-auto mb-3 text-ink-200" aria-hidden="true" />
          <p className="text-base font-semibold text-ink-900">{t("empty")}</p>
          <p className="mt-1 text-sm text-ink-400">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-5 py-3.5">
              {s.active ? (
                <Avatar id={s.id} name={s.name ?? s.email} className="size-8 text-xs" px={32} />
              ) : (
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-50 text-ink-400">
                  <Mail size={14} aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{s.name ?? s.email}</p>
                <p className="truncate text-xs text-ink-400">
                  {s.name ? `${s.email} · ` : ""}
                  {t(s.active ? "joined" : "invitedOn", {
                    date: format(new Date(s.since), "d MMM yyyy", { locale: dateLocale(locale) }),
                  })}
                </p>
              </div>
              <span
                className={`${BADGE} shrink-0 ${s.active ? "bg-brand-100 text-brand-900" : NEUTRAL_TONE}`}
              >
                {t(s.active ? "active" : "pending")}
              </span>
              <DeleteButton title={hint} disabled={readOnly || pending} className="shrink-0" onClick={() => setRemoving(s)}>
                {t("remove")}
              </DeleteButton>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!removing} onClose={() => setRemoving(null)}>
        <Modal.Content className="max-w-md">
          <Modal.Header>{t("removeTitle")}</Modal.Header>
          <Modal.Body>
            <p className="text-sm text-ink-600">
              {removing && t("removeText", { name: removing.name ?? removing.email })}
            </p>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" onClick={() => setRemoving(null)} className="btn-secondary flex-1">
              {t("keep")}
            </button>
            <button
              type="button"
              onClick={() => removing && remove(removing)}
              className="btn-danger flex-1"
            >
              {t("remove")}
            </button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </div>
  );
}
