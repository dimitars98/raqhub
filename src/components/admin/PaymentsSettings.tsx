"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, CreditCard, ExternalLink, FlaskConical, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { connectStripe, refreshStripe, savePaymentMode } from "@/app/[locale]/admin/settings/payments";
import { useReadOnly } from "@/components/admin/ReadOnly";
import type { PayMode } from "@/lib/paymentMode";

export type PaymentsInfo = {
  /** RaqHub has Stripe keys. */
  configured: boolean;
  testMode: boolean;
  /** The club has a Stripe account (maybe not finished). */
  connected: boolean;
  /** Stripe says the account can take payments. */
  ready: boolean;
  mode: PayMode;
  /** Staff can't change payments. */
  isOwner: boolean;
};

/** Settings → Online payments: connect Stripe, then choose how players pay. */
export default function PaymentsSettings({ info }: { info: PaymentsInfo }) {
  const t = useTranslations("payments.settings");
  const router = useRouter();
  const { readOnly, hint } = useReadOnly();
  const [mode, setMode] = useState<PayMode>(info.mode);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const connect = () =>
    start(async () => {
      setError(null);
      const r = await connectStripe();
      if (r.url) window.location.assign(r.url);
      else setError(t(`errors.${r.error ?? "failed"}`));
    });

  const check = () =>
    start(async () => {
      setError(null);
      const r = await refreshStripe();
      if (r.error) setError(t(`errors.${r.error}`));
      router.refresh();
    });

  const choose = (m: PayMode) =>
    start(async () => {
      setError(null);
      setSaved(false);
      const prev = mode;
      setMode(m);
      const r = await savePaymentMode(m);
      if (r.error) {
        setMode(prev);
        setError(t(`errors.${r.error}`));
      } else setSaved(true);
    });

  const disabled = pending || readOnly || !info.isOwner;

  return (
    <div className="bg-white border border-[#e8ede4] rounded-2xl p-5 sm:p-7">
      <div className="mb-6 pb-5 border-b border-[#e8ede4]">
        <h2 className="text-[18px] font-semibold text-[#111c0a]">{t("title")}</h2>
        <p className="text-[13px] text-[#6e7f65] mt-1">{t("description")}</p>
      </div>

      <div className="flex flex-col gap-5">
        {!info.configured ? (
          <p className="rounded-xl bg-[#f4f6f2] px-4 py-3 text-[13px] text-[#3d4f35]">{t("notConfigured")}</p>
        ) : (
          <>
            {info.testMode && (
              <p className="flex items-start gap-2 rounded-xl bg-[#fdf5df] px-4 py-3 text-[13px] text-[#5c4000]">
                <FlaskConical size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{t("testMode")}</span>
              </p>
            )}

            {/* Stripe account */}
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#e8ede4] p-4">
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                  info.ready ? "bg-[#f1f9dc] text-[#2e4d03]" : "bg-[#f4f6f2] text-[#3d4f35]"
                }`}
              >
                {info.ready ? <CheckCircle2 size={20} aria-hidden="true" /> : <CreditCard size={20} aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#111c0a]">
                  {info.ready ? t("ready") : info.connected ? t("unfinished") : t("notConnected")}
                </p>
                <p className="mt-0.5 text-[13px] text-[#6e7f65]">
                  {info.ready ? t("readyHint") : info.connected ? t("unfinishedHint") : t("notConnectedHint")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {info.ready ? (
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary inline-flex items-center gap-1.5 text-[13px]"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    {t("openStripe")}
                  </a>
                ) : (
                  <>
                    {info.connected && (
                      <button type="button" onClick={check} disabled={pending} className="btn-secondary text-[13px]">
                        {t("checkAgain")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={connect}
                      disabled={disabled}
                      title={hint}
                      className="btn-primary inline-flex items-center gap-1.5 text-[13px] disabled:opacity-50"
                    >
                      {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                      {info.connected ? t("continue") : t("connect")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* How players pay */}
            <fieldset disabled={!info.ready || disabled} className="flex flex-col gap-2 disabled:opacity-60">
              <legend className="mb-2 text-[13px] font-medium text-[#3d4f35]">{t("howTitle")}</legend>
              {(["club", "online", "either"] as const).map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    mode === m ? "border-[#111c0a] bg-[#fbfdf6]" : "border-[#e8ede4] hover:border-[#c9d2c2]"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => choose(m)}
                    className="mt-1 accent-[#111c0a]"
                  />
                  <span>
                    <span className="block text-[14px] font-semibold text-[#111c0a]">{t(`modes.${m}`)}</span>
                    <span className="mt-0.5 block text-[13px] text-[#6e7f65]">{t(`modes.${m}Hint`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {!info.ready && <p className="-mt-2 text-xs text-[#6e7f65]">{t("modesAfterConnect")}</p>}
            {saved && (
              <p role="status" className="text-[13px] text-[#2e4d03]">
                {t("saved")}
              </p>
            )}
            <p className="text-xs text-[#6e7f65]">{t("notes")}</p>
          </>
        )}
        {!info.isOwner && <p className="text-xs text-[#6e7f65]">{t("ownerOnly")}</p>}
        {error && (
          <p role="alert" className="text-[13px] text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
