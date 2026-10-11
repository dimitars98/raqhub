"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
  { code: "mk", label: "МК" },
  // { code: "sq", label: "SQ" },
];

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex items-center gap-1">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          onClick={() => switchLocale(l.code)}
          className={`text-xs px-2 py-1 rounded-md transition-colors cursor-pointer ${
            locale === l.code
              ? "bg-brand-600 text-white"
              : "text-brand-600 hover:bg-brand-100"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
