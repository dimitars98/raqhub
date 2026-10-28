"use client";

import { useState, type ComponentPropsWithRef } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";

/**
 * A password field with an eye button to show what was typed. Takes the same
 * props as <input> (including react-hook-form's register), so it drops in
 * wherever a type="password" input was.
 */
export default function PasswordInput({
  className = "",
  ...props
}: Omit<ComponentPropsWithRef<"input">, "type">) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className} pr-14`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        aria-controls={props.id}
        title={visible ? t("hidePassword") : t("showPassword")}
        className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-xl text-ink-400 transition-colors hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none cursor-pointer"
      >
        {visible ? (
          <EyeOff size={22} aria-hidden="true" />
        ) : (
          <Eye size={22} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
