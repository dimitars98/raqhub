"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/layout/AuthShell";
import { homeFor } from "@/lib/roles";
import type { Profile } from "@/types/database";
import PasswordInput from "@/components/ui/PasswordInput";

type Values = { password: string; confirm: string };

/**
 * Choosing a new password, after the link in the "reset your password" email.
 * The link signed the person in (see /api/auth/callback); without that the
 * page asks for a new link.
 */
export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, [supabase]);

  const onSubmit = async ({ password }: Values) => {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) {
      const message =
        error.code === "same_password"
          ? t("samePassword")
          : error.code === "weak_password"
            ? t("passwordMinLength")
            : error.code === "session_not_found" || error.status === 401
              ? t("resetExpired")
              : t("genericError");
      setError("root", { message });
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    const role = (profile as Pick<Profile, "role"> | null)?.role;
    router.push(`/${locale}${homeFor(role)}`);
    router.refresh();
  };

  const linkClass =
    "font-semibold text-ink-900 underline decoration-brand-400 decoration-2 underline-offset-4 hover:decoration-ink-900";

  return (
    <AuthShell>
      <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">{t("resetTitle")}</h1>

      {signedIn === false ? (
        <>
          <p role="alert" className="mb-8 rounded-2xl bg-amber-50 px-5 py-3.5 text-sm text-amber-900">
            {t("resetExpired")}
          </p>
          <Link href={`/${locale}/forgot-password`} className="btn-primary h-14 w-full justify-center text-base font-semibold">
            {t("requestNewLink")}
          </Link>
        </>
      ) : (
        <>
          <p className="mb-8 text-base leading-relaxed text-ink-600">{t("resetIntro")}</p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-ink-800">
                {t("newPassword")}
              </label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                autoFocus
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : "password-hint"}
                className={`input h-14 rounded-2xl px-5 text-base ${errors.password ? "border-red-500" : ""}`}
                {...register("password", {
                  required: t("passwordRequired"),
                  minLength: { value: 8, message: t("passwordMinLength") },
                })}
              />
              {errors.password ? (
                <p id="password-error" className="text-sm text-red-600">
                  {errors.password.message}
                </p>
              ) : (
                <p id="password-hint" className="text-sm text-ink-400">
                  {t("passwordMinLength")}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="confirm" className="text-sm font-medium text-ink-800">
                {t("confirmPassword")}
              </label>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                aria-invalid={!!errors.confirm}
                aria-describedby={errors.confirm ? "confirm-error" : undefined}
                className={`input h-14 rounded-2xl px-5 text-base ${errors.confirm ? "border-red-500" : ""}`}
                {...register("confirm", {
                  validate: (v) => v === getValues("password") || t("passwordMismatch"),
                })}
              />
              {errors.confirm && (
                <p id="confirm-error" className="text-sm text-red-600">
                  {errors.confirm.message}
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
              disabled={isSubmitting || signedIn === null}
              className="btn-primary mt-2 h-14 w-full justify-center text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t("savingPassword") : t("savePassword")}
            </button>
          </form>
          <p className="mt-8 text-base text-ink-600">
            <Link href={`/${locale}/login`} className={linkClass}>
              {t("backToSignIn")}
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
