"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { announceNewClub } from "@/app/actions/clubs";
import { intlLocale } from "@/lib/dateLocale";

type CreateClubValues = {
  name: string;
  city: string;
  country: string;
};

// Stored as the two-letter code, like the column's default ('MK').
// Names are shown in the visitor's language by the browser (Intl.DisplayNames).
const COUNTRY_CODES = [
  "AL", "AT", "BA", "BG", "HR", "FR", "DE", "GR", "IT", "XK",
  "ME", "MK", "RS", "SI", "CH",
] as const;

/**
 * Turns a club name into a URL-safe slug and adds a short random ending so
 * two clubs with the same name never clash. Names written in Cyrillic have
 * no Latin letters to keep, so they fall back to "club".
 */
function makeSlug(name: string) {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "club";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

const labelClass = "text-[13px] font-medium text-[#3d4f35]";
const errorClass = "text-xs text-red-600";

/**
 * First thing a new club owner sees. Kept to three questions on purpose:
 * everything else (address, phone, logo, hours) can wait for Settings, and
 * the getting-started checklist on the dashboard walks them through it.
 */
export default function CreateClubForm({
  ownerId,
  defaultEmail = "",
}: {
  ownerId: string;
  defaultEmail?: string;
}) {
  const t = useTranslations("setup");
  const locale = useLocale();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateClubValues>({
    defaultValues: { country: "MK" },
  });

  const countries = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([intlLocale(locale)], { type: "region" });
    } catch {
      // Very old browsers: fall back to the codes.
    }
    return COUNTRY_CODES.map((code) => [code, names?.of(code) ?? code] as const).sort(
      (a, b) => a[1].localeCompare(b[1], locale),
    );
  }, [locale]);

  const onSubmit = async (values: CreateClubValues) => {
    const supabase = createClient();
    const name = values.name.trim();

    const { error } = await supabase.from("clubs").insert({
      name,
      slug: makeSlug(name),
      city: values.city.trim(),
      country: values.country,
      // Players' replies to booking emails go here; changeable in Settings.
      email: defaultEmail.trim() || null,
      owner_id: ownerId,
    });

    if (error) {
      setError("root", { message: t("error") });
      return;
    }

    // Lets you know a new club signed up; never holds up the owner.
    await announceNewClub().catch(() => {});

    router.push("/admin/dashboard");
    // Reloads server data so the sidebar and pages pick up the new club.
    router.refresh();
  };

  return (
    <div className="mx-auto w-full max-w-lg py-8">
      <div className="mb-4 grid size-12 place-items-center rounded-xl bg-[#f3fbde] text-[#4d7a08]">
        <Building2 size={22} aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-[#111c0a]">
        {t("title")}
      </h1>
      <p className="mt-1 mb-6 text-sm text-[#6e7f65]">{t("subtitle")}</p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="card flex flex-col gap-5 p-6"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="club-name" className={labelClass}>
            {t("name")}
          </label>
          <input
            id="club-name"
            type="text"
            autoComplete="organization"
            autoFocus
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "club-name-error" : undefined}
            className={`input ${errors.name ? "border-red-500" : ""}`}
            {...register("name", {
              validate: (value) => value.trim().length >= 2 || t("nameError"),
            })}
          />
          {errors.name && (
            <p id="club-name-error" className={errorClass}>
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="club-city" className={labelClass}>
              {t("city")}
            </label>
            <input
              id="club-city"
              type="text"
              autoComplete="address-level2"
              aria-invalid={!!errors.city}
              aria-describedby={errors.city ? "club-city-error" : undefined}
              className={`input ${errors.city ? "border-red-500" : ""}`}
              {...register("city", {
                validate: (value) => value.trim().length > 0 || t("cityError"),
              })}
            />
            {errors.city && (
              <p id="club-city-error" className={errorClass}>
                {errors.city.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="club-country" className={labelClass}>
              {t("country")}
            </label>
            <select
              id="club-country"
              autoComplete="country"
              className="input"
              {...register("country")}
            >
              {countries.map(([code, label]) => (
                // Server and browser may word a country slightly differently.
                <option key={code} value={code} suppressHydrationWarning>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errors.root && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#6e7f65]">{t("trialNote")}</p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary justify-center whitespace-nowrap sm:px-8 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? t("creating") : t("create")}
          </button>
        </div>
      </form>
    </div>
  );
}
