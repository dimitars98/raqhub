"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Trash2 } from "lucide-react";
import { removeEventCover, uploadEventCover, type EventKind } from "@/app/actions/eventCovers";
import { resizeImage } from "@/lib/resizeImage";
import { useReadOnly } from "@/components/admin/ReadOnly";

/**
 * The poster of a league, tournament or Americano evening, on its admin page.
 * It uploads straight away; the public page and shared links use it.
 */
export default function EventCoverPicker({ kind, id, url: initial }: { kind: EventKind; id: string; url: string | null }) {
  const t = useTranslations("eventPage");
  const { readOnly, hint } = useReadOnly();
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError(t("coverNotImage"));
    setBusy(true);
    try {
      const small = await resizeImage(file, 1600);
      const fd = new FormData();
      fd.append("image", small, "poster.jpg");
      const result = await uploadEventCover(kind, id, fd);
      if (result.ok) setUrl(result.url);
      else setError(result.reason === "tooBig" ? t("coverTooBig") : result.reason === "notImage" ? t("coverNotImage") : t("coverError"));
    } catch {
      // A format the browser can't open (e.g. some HEIC photos).
      setError(t("coverNotImage"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const result = await removeEventCover(kind, id);
    if (result.ok) setUrl(null);
    else setError(t("coverError"));
    setBusy(false);
  };

  return (
    <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-ink-100 bg-white p-4">
      <div className="grid h-32 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-ink-200 bg-[#f8f9f7]">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={22} className="text-ink-400" aria-hidden="true" />
        )}
      </div>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink-900">{t("coverTitle")}</h2>
        <p className={`text-[13px] ${error ? "text-red-600" : "text-ink-600"}`} role={error ? "alert" : undefined}>
          {error ?? t("coverHint")}
        </p>
        <div className="flex flex-wrap gap-2">
          <label
            title={hint}
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 text-[13px] font-medium text-ink-900 transition-colors hover:border-ink-400 focus-within:ring-2 focus-within:ring-brand-400 ${
              busy || readOnly ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <ImagePlus size={15} aria-hidden="true" />
            {busy ? t("coverUploading") : url ? t("coverChange") : t("coverUpload")}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy || readOnly}
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {url && (
            <button
              type="button"
              onClick={remove}
              disabled={busy || readOnly}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} aria-hidden="true" />
              {t("coverRemove")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
