"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Download, MessageCircle, Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";

type Props = {
  link: string;
  /** QR code as an SVG string, made on the server. */
  qr: string;
  /** Ready-made message for players, already containing the link. */
  message: string;
  posterHref: string;
  fileName: string;
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      // Clipboard blocked (old browser or not https): the text is still on screen.
    }
  };
  return { copied, copy };
}

/** Copy icon that turns into a tick for a moment after copying. */
function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <Check size={15} aria-hidden="true" />
  ) : (
    <Copy size={15} aria-hidden="true" />
  );
}

export default function ShareClient({ link, qr, message, posterHref, fileName }: Props) {
  const t = useTranslations("share");
  const { copied, copy } = useCopy();
  const encoded = encodeURIComponent(message);

  const downloadQr = () => {
    const url = URL.createObjectURL(new Blob([qr], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-ink-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-5">
          {/* Link */}
          <section className="rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="text-sm font-semibold text-ink-900">{t("linkTitle")}</h2>
            <p className="mt-1 text-sm text-ink-600">{t("linkBody")}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="input min-w-0 flex-1 font-mono text-[13px]"
                aria-label={t("linkTitle")}
              />
              <button
                type="button"
                onClick={() => copy("link", link)}
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                <CopyIcon done={copied === "link"} />
                {copied === "link" ? t("copied") : t("copyLink")}
              </button>
            </div>
          </section>

          {/* Message */}
          <section className="rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="text-sm font-semibold text-ink-900">{t("messageTitle")}</h2>
            <p className="mt-1 text-sm text-ink-600">{t("messageBody")}</p>
            <p className="mt-3 whitespace-pre-line rounded-xl bg-ink-50 p-4 text-sm text-ink-800">
              {message}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copy("message", message)}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <CopyIcon done={copied === "message"} />
                {copied === "message" ? t("copied") : t("copyMessage")}
              </button>
              <a
                href={`https://wa.me/?text=${encoded}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center gap-2"
              >
                <MessageCircle size={15} aria-hidden="true" />
                WhatsApp
              </a>
              <a
                href={`viber://forward?text=${encoded}`}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <MessageCircle size={15} aria-hidden="true" />
                Viber
              </a>
            </div>
          </section>
        </div>

        {/* QR code and poster */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink-900">{t("qrTitle")}</h2>
          <p className="mt-1 text-sm text-ink-600">{t("qrBody")}</p>
          <div
            className="mx-auto mt-4 w-full max-w-[220px] [&>svg]:h-auto [&>svg]:w-full"
            role="img"
            aria-label={t("qrAlt")}
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href={posterHref}
              target="_blank"
              className="btn-primary inline-flex items-center justify-center gap-2"
            >
              <Printer size={15} aria-hidden="true" />
              {t("printPoster")}
            </Link>
            <button
              type="button"
              onClick={downloadQr}
              className="btn-secondary inline-flex items-center justify-center gap-2"
            >
              <Download size={15} aria-hidden="true" />
              {t("downloadQr")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
