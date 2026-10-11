"use client";

import { useForm } from "react-hook-form";
import { Building2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

type CreateClubValues = {
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
};

// Stored as the two-letter code, like the column's default ('MK').
const COUNTRIES = [
  ["AL", "Albania"],
  ["AT", "Austria"],
  ["BA", "Bosnia and Herzegovina"],
  ["BG", "Bulgaria"],
  ["HR", "Croatia"],
  ["DE", "Germany"],
  ["GR", "Greece"],
  ["XK", "Kosovo"],
  ["ME", "Montenegro"],
  ["MK", "North Macedonia"],
  ["RS", "Serbia"],
  ["SI", "Slovenia"],
  ["CH", "Switzerland"],
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
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "club";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

/** Empty text becomes null so the database doesn't store blank strings. */
const orNull = (value: string) => value.trim() || null;

/** Accepts "myclub.mk" as well as a full address. */
function normalizeWebsite(value: string) {
  const v = value.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

const labelClass = "text-[13px] font-medium text-[#3d4f35]";
const optionalClass = "font-normal text-[#6e7f65]";
const errorClass = "text-xs text-red-600";

export default function CreateClubForm({
  ownerId,
  defaultEmail = "",
}: {
  ownerId: string;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateClubValues>({
    defaultValues: { country: "MK", email: defaultEmail },
  });

  const onSubmit = async (values: CreateClubValues) => {
    const supabase = createClient();
    const name = values.name.trim();

    const { error } = await supabase.from("clubs").insert({
      name,
      slug: makeSlug(name),
      description: orNull(values.description),
      address: orNull(values.address),
      city: orNull(values.city),
      country: values.country,
      phone: orNull(values.phone),
      email: orNull(values.email),
      website: normalizeWebsite(values.website),
      owner_id: ownerId,
    });

    if (error) {
      setError("root", {
        message: "We couldn't create your club. Please try again.",
      });
      return;
    }

    router.push("/admin/courts");
    // Reloads server data so the sidebar and pages pick up the new club.
    router.refresh();
  };

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <div className="mb-4 grid size-12 place-items-center rounded-xl bg-[#f3fbde] text-[#4d7a08]">
        <Building2 size={22} aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-[#111c0a]">
        Set up your club
      </h1>
      <p className="mt-1 mb-6 text-sm text-[#6e7f65]">
        Players see these details when they book. You can change any of them
        later.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="card divide-y divide-[#e8ede4]"
      >
        {/* About */}
        <fieldset className="flex flex-col gap-5 p-6">
          <legend className="float-left mb-1 w-full text-base font-semibold text-[#111c0a]">
            About the club
          </legend>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="club-name" className={labelClass}>
              Club name
            </label>
            <input
              id="club-name"
              type="text"
              autoComplete="organization"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "club-name-error" : undefined}
              className={`input ${errors.name ? "border-red-500" : ""}`}
              {...register("name", {
                validate: (value) =>
                  value.trim().length >= 2 || "Enter your club's name.",
              })}
            />
            {errors.name && (
              <p id="club-name-error" className={errorClass}>
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="club-description" className={labelClass}>
              Short description{" "}
              <span className={optionalClass}>(optional)</span>
            </label>
            <textarea
              id="club-description"
              rows={3}
              maxLength={400}
              className="input resize-y"
              {...register("description")}
            />
          </div>
        </fieldset>

        {/* Location */}
        <fieldset className="flex flex-col gap-5 p-6">
          <legend className="float-left mb-1 w-full text-base font-semibold text-[#111c0a]">
            Location
          </legend>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="club-address" className={labelClass}>
              Street address <span className={optionalClass}>(optional)</span>
            </label>
            <input
              id="club-address"
              type="text"
              autoComplete="street-address"
              className="input"
              {...register("address")}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="club-city" className={labelClass}>
                City
              </label>
              <input
                id="club-city"
                type="text"
                autoComplete="address-level2"
                aria-invalid={!!errors.city}
                aria-describedby={errors.city ? "club-city-error" : undefined}
                className={`input ${errors.city ? "border-red-500" : ""}`}
                {...register("city", {
                  validate: (value) =>
                    value.trim().length > 0 || "Enter the city.",
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
                Country
              </label>
              <select
                id="club-country"
                autoComplete="country"
                className="input"
                {...register("country")}
              >
                {COUNTRIES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Contact */}
        <fieldset className="flex flex-col gap-5 p-6">
          <legend className="float-left mb-1 w-full text-base font-semibold text-[#111c0a]">
            Contact
          </legend>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="club-phone" className={labelClass}>
                Phone <span className={optionalClass}>(optional)</span>
              </label>
              <input
                id="club-phone"
                type="tel"
                autoComplete="tel"
                className="input"
                {...register("phone")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="club-email" className={labelClass}>
                Contact email <span className={optionalClass}>(optional)</span>
              </label>
              <input
                id="club-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "club-email-error" : undefined}
                className={`input ${errors.email ? "border-red-500" : ""}`}
                {...register("email", {
                  validate: (value) =>
                    !value.trim() ||
                    /^\S+@\S+\.\S+$/.test(value.trim()) ||
                    "Enter a valid email address.",
                })}
              />
              {errors.email && (
                <p id="club-email-error" className={errorClass}>
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="club-website" className={labelClass}>
              Website <span className={optionalClass}>(optional)</span>
            </label>
            <input
              id="club-website"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="yourclub.mk"
              className="input"
              {...register("website")}
            />
          </div>
        </fieldset>

        {/* Submit */}
        <div className="flex flex-col gap-4 p-6">
          {errors.root && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {errors.root.message}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary justify-center sm:self-end sm:px-8 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating…" : "Create club"}
          </button>
        </div>
      </form>
    </div>
  );
}
