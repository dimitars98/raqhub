"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { useTranslations, useLocale } from "next-intl";
import type { Profile } from "@/types/database";
import { LogoMark } from "@/components/ui/Logo";
import { getSafeRedirect } from "@/lib/safeRedirect";
import { homeFor } from "@/lib/roles";
import PasswordInput from "@/components/ui/PasswordInput";
import Image from "next/image";

type LoginValues = {
  email: string;
  password: string;
};

// Only allow redirects to paths inside this site
export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const t = useTranslations("auth");
  const locale = useLocale();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>();

  const onSubmit = async ({ email, password }: LoginValues) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      const invalidCredentials =
        error.code === "invalid_credentials" ||
        error.message === "Invalid login credentials";
      setError("root", {
        message: invalidCredentials
          ? t("invalidCredentials")
          : t("genericError"),
      });
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    const role = (profileData as Pick<Profile, "role"> | null)?.role;

    const redirectTo = getSafeRedirect(params.get("redirectTo"));
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.push(`/${locale}${homeFor(role)}`);
    }
    router.refresh();
  };

  const handleGoogle = async () => {
    clearErrors("root");
    const callback = new URL("/api/auth/callback", location.origin);
    callback.searchParams.set("locale", locale);
    const redirectTo = getSafeRedirect(params.get("redirectTo"));
    if (redirectTo) callback.searchParams.set("next", redirectTo);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (error) setError("root", { message: t("genericError") });
  };

  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-2">
      {/* Form side */}
      <div className="flex min-h-dvh flex-col px-6 py-8 sm:px-10 lg:px-16">
        <Link
          href={`/${locale}`}
          className="inline-flex w-fit items-center gap-2 text-xl font-semibold tracking-tight text-brand-900"
        >
          {/* <LogoMark className="size-8" /> */}
          <Image src="/raqhub.png" alt="RaqHub" width={40} height={40} />
          RaqHub
        </Link>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-md">
            <h1 className="mb-10 text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
              {t("signIn")}
            </h1>

            <button
              type="button"
              onClick={handleGoogle}
              className="btn-secondary flex h-14 w-full items-center justify-center gap-3 text-base font-semibold"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
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
                  htmlFor="email"
                  className="text-sm font-medium text-ink-800"
                >
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
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-ink-800"
                  >
                    {t("password")}
                  </label>
                  <Link
                    href={`/${locale}/forgot-password`}
                    className="text-sm font-medium text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline"
                  >
                    {t("forgotLink")}
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  className={`input h-14 rounded-2xl px-5 text-base ${
                    errors.password ? "border-red-500" : ""
                  }`}
                  {...register("password", {
                    required: t("passwordRequired"),
                  })}
                />
                {errors.password && (
                  <p id="password-error" className="text-sm text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Google sign-in came back without a session (see api/auth/callback) */}
              {!errors.root &&
                params.get("error") === "auth_callback_failed" && (
                  <p
                    role="alert"
                    className="rounded-2xl bg-red-50 px-5 py-3.5 text-sm text-red-700"
                  >
                    {t("callbackFailed")}
                  </p>
                )}
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
                {isSubmitting ? t("signingIn") : t("signIn")}
              </button>
            </form>

            <p className="mt-8 text-base text-ink-600">
              {t("noAccount")}{" "}
              <Link
                href={`/${locale}/signup?role=player`}
                className="font-semibold text-ink-900 underline decoration-brand-400 decoration-2 underline-offset-4 hover:decoration-ink-900"
              >
                {t("signUpPlayer")}
              </Link>
              {" · "}
              <Link
                href={`/${locale}/signup?role=admin`}
                className="font-semibold text-ink-900 underline decoration-brand-400 decoration-2 underline-offset-4 hover:decoration-ink-900"
              >
                {t("tennisClub")}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Court side — decorative, desktop only */}
      <div
        aria-hidden="true"
        className="hidden p-4 lg:sticky lg:top-0 lg:block lg:h-dvh"
      >
        <div className="relative h-full overflow-hidden rounded-[2rem] bg-brand-400 text-ink-900">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 600 800"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
          >
            {/* Top-down court, tilted and cropped by the panel edges */}
            <g transform="translate(300 400) rotate(-20) scale(1.25) translate(-180 -390)">
              {/* Playing surface */}
              <rect
                x="0"
                y="0"
                width="360"
                height="780"
                fill="currentColor"
                opacity="0.07"
              />
              <g stroke="currentColor" strokeWidth="4">
                {/* Doubles court outline */}
                <rect x="0" y="0" width="360" height="780" />
                {/* Singles sidelines */}
                <line x1="45" y1="0" x2="45" y2="780" />
                <line x1="315" y1="0" x2="315" y2="780" />
                {/* Service lines */}
                <line x1="45" y1="180" x2="315" y2="180" />
                <line x1="45" y1="600" x2="315" y2="600" />
                {/* Centre service line */}
                <line x1="180" y1="180" x2="180" y2="600" />
                {/* Centre marks */}
                <line x1="180" y1="0" x2="180" y2="14" />
                <line x1="180" y1="766" x2="180" y2="780" />
              </g>
              {/* Net */}
              <line
                x1="-24"
                y1="390"
                x2="384"
                y2="390"
                stroke="currentColor"
                strokeWidth="8"
              />
            </g>

            {/* Ball and its shadow */}
            <ellipse
              cx="420"
              cy="506"
              rx="24"
              ry="9"
              fill="currentColor"
              opacity="0.18"
            />
            <circle
              cx="408"
              cy="470"
              r="22"
              fill="white"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              d="M392 456c10 6 14 18 10 30"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
