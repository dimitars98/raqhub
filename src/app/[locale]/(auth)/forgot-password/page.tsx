"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/layout/AuthShell";

type Values = { email: string };

/**
 * "Forgot password?": Supabase emails a link. It goes through
 * /api/auth/callback (which signs the person in for this one purpose) and
 * on to /reset-password, where they choose a new password.
 */
export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const params = useSearchParams();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: { email: params.get("email") ?? "" } });

  const onSubmit = async ({ email }: Values) => {
    const callback = new URL("/api/auth/callback", location.origin);
    callback.searchParams.set("locale", locale);
    callback.searchParams.set("next", `/${locale}/reset-password`);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: callback.toString(),
    });
    // Too many requests is worth saying; anything else about the address isn't,
    // so nobody can use this page to find out who has an account.
    if (error && error.status === 429) {
      setError("root", { message: t("tooManyRequests") });
      return;
    }
    // No connection: the email surely wasn't sent.
    if (error && error.name === "AuthRetryableFetchError") {
      setError("root", { message: t("genericError") });
      return;
    }
    if (error) console.error("[forgot password]", error.message);
    setSentTo(email.trim());
  };

  return (
    <AuthShell>
      {sentTo ? (
        <div className="flex flex-col items-start gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-800">
            <MailCheck size={26} aria-hidden="true" />
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink-900">{t("checkEmail")}</h1>
          <p role="status" className="text-base leading-relaxed text-ink-600">
            {t.rich("resetSent", { email: sentTo, b: (c) => <strong className="text-ink-900">{c}</strong> })}
          </p>
          <p className="text-sm text-ink-400">{t("resetSentHint")}</p>
          <Link
            href={`/${locale}/login`}
            className="mt-4 font-semibold text-ink-900 underline decoration-brand-400 decoration-2 underline-offset-4 hover:decoration-ink-900"
          >
            {t("backToSignIn")}
          </Link>
        </div>
      ) : (
        <>
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">{t("forgotTitle")}</h1>
          <p className="mb-8 text-base leading-relaxed text-ink-600">{t("forgotIntro")}</p>

          {params.get("expired") && (
            <p role="alert" className="mb-5 rounded-2xl bg-amber-50 px-5 py-3.5 text-sm text-amber-900">
              {t("resetExpired")}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-ink-800">
                {t("email")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={`input h-14 rounded-2xl px-5 text-base ${errors.email ? "border-red-500" : ""}`}
                {...register("email", {
                  required: t("emailRequired"),
                  pattern: { value: /^\S+@\S+\.\S+$/, message: t("emailInvalid") },
                })}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            {errors.root && (
              <p role="alert" className="rounded-2xl bg-red-50 px-5 py-3.5 text-sm text-red-700">
                {errors.root.message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary mt-2 h-14 w-full justify-center text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t("sendingLink") : t("sendLink")}
            </button>
          </form>

          <p className="mt-8 text-base text-ink-600">
            <Link
              href={`/${locale}/login`}
              className="font-semibold text-ink-900 underline decoration-brand-400 decoration-2 underline-offset-4 hover:decoration-ink-900"
            >
              {t("backToSignIn")}
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
