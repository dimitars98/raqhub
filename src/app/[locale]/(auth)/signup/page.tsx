"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { useTranslations, useLocale } from "next-intl";
import { Check } from "lucide-react";
import AuthShell from "@/components/layout/AuthShell";

type SignupValues = {
  fullName: string;
  email: string;
  password: string;
};

export default function SignupPage() {
  // Set to the submitted address once the account is created
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const supabase = createClient();
  const t = useTranslations("auth");
  const locale = useLocale();

  const roleParam = searchParams.get("role");
  const isAdmin = roleParam === "admin";
  const role = isAdmin ? "club_admin" : "player";

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>();

  const onSubmit = async ({ fullName, email, password }: SignupValues) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim(), role } },
    });

    if (error) {
      if (error.code === "user_already_exists") {
        setError("email", { message: t("emailTaken") });
      } else if (error.code === "weak_password") {
        setError("password", { message: t("passwordMinLength") });
      } else {
        setError("root", { message: t("genericError") });
      }
      return;
    }
    setConfirmedEmail(email);
  };

  const handleGoogle = async () => {
    clearErrors("root");
    const callback = new URL("/api/auth/callback", location.origin);
    callback.searchParams.set("locale", locale);
    if (isAdmin) callback.searchParams.set("role", "admin");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (error) setError("root", { message: t("genericError") });
  };

  // Clubs get the dark panel, players the lime one
  const tone = isAdmin ? "ink" : "lime";

  if (confirmedEmail) {
    return (
      <AuthShell tone={tone}>
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
          <Check
            size={30}
            className="text-brand-800"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </div>
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
          {t("checkEmail")}
        </h1>
        <p className="text-base leading-relaxed text-ink-600">
          {t("confirmationSent")}{" "}
          <strong className="font-semibold text-ink-900 break-all">
            {confirmedEmail}
          </strong>
          .
        </p>
        <Link
          href={`/${locale}/login`}
          className="btn-primary mt-10 h-14 justify-center px-8 text-base font-semibold"
        >
          {t("backToSignIn")}
        </Link>
      </AuthShell>
    );
  }

  const roleTab = (active: boolean) =>
    `flex h-11 items-center justify-center rounded-full px-3 text-center text-sm font-semibold transition-colors ${
      active ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"
    }`;

  return (
    <AuthShell tone={tone}>
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
        {isAdmin ? t("createClubAccount") : t("createPlayerAccount")}
      </h1>

      {/* Account type switch */}
      <div className="mb-8 grid grid-cols-2 gap-1 rounded-full bg-ink-50 p-1">
        <Link
          href={`/${locale}/signup?role=player`}
          aria-current={!isAdmin ? "page" : undefined}
          className={roleTab(!isAdmin)}
        >
          {t("playerAccount")}
        </Link>
        <Link
          href={`/${locale}/signup?role=admin`}
          aria-current={isAdmin ? "page" : undefined}
          className={roleTab(isAdmin)}
        >
          {t("clubAccount")}
        </Link>
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        className="btn-secondary flex h-14 w-full items-center justify-center gap-3 text-base font-semibold"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {t("continueGoogle")}
      </button>

      <div className="my-7 flex items-center gap-4">
        <div className="h-px flex-1 bg-ink-100" />
        <span className="text-sm text-ink-400">{t("or")}</span>
        <div className="h-px flex-1 bg-ink-100" />
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-2">
          <label
            htmlFor="fullName"
            className="text-sm font-medium text-ink-800"
          >
            {t("fullName")}
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? "fullName-error" : undefined}
            className={`input h-14 rounded-2xl px-5 text-base ${
              errors.fullName ? "border-red-500" : ""
            }`}
            {...register("fullName", {
              validate: (value) =>
                value.trim().length > 0 || t("fullNameRequired"),
            })}
          />
          {errors.fullName && (
            <p id="fullName-error" className="text-sm text-red-600">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium text-ink-800">
            {t("email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={`input h-14 rounded-2xl px-5 text-base ${
              errors.email ? "border-red-500" : ""
            }`}
            {...register("email", {
              required: t("emailRequired"),
              pattern: {
                value: /^\S+@\S+\.\S+$/,
                message: t("emailInvalid"),
              },
            })}
          />
          {errors.email && (
            <p id="email-error" className="text-sm text-red-600">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-ink-800"
          >
            {t("password")}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby="password-hint"
            className={`input h-14 rounded-2xl px-5 text-base ${
              errors.password ? "border-red-500" : ""
            }`}
            {...register("password", {
              required: t("passwordRequired"),
              minLength: { value: 8, message: t("passwordMinLength") },
            })}
          />
          {/* Shows the length rule as a hint, and turns red when there's an error */}
          <p
            id="password-hint"
            className={`text-sm ${
              errors.password ? "text-red-600" : "text-ink-400"
            }`}
          >
            {errors.password?.message ?? t("passwordMinLength")}
          </p>
        </div>

        {errors.root && (
          <p
            role="alert"
            className="rounded-2xl bg-red-50 px-5 py-3.5 text-sm text-red-700"
          >
            {errors.root.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary mt-2 h-14 w-full justify-center text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? t("creatingAccount") : t("createAccount")}
        </button>

        <p className="text-center text-sm leading-relaxed text-ink-400">
          {t.rich("agreeToTerms", {
            terms: (chunks) => (
              <Link
                href={`/${locale}/terms`}
                target="_blank"
                className="font-medium text-ink-600 underline underline-offset-2 hover:text-ink-900"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link
                href={`/${locale}/privacy`}
                target="_blank"
                className="font-medium text-ink-600 underline underline-offset-2 hover:text-ink-900"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </form>

      <p className="mt-8 text-base text-ink-600">
        {t("alreadyAccount")}{" "}
        <Link
          href={`/${locale}/login`}
          className="font-semibold text-ink-900 underline decoration-brand-400 decoration-2 underline-offset-4 hover:decoration-ink-900"
        >
          {t("signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}
