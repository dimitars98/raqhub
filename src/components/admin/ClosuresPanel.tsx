"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Ban } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { intlLocale } from "@/lib/dateLocale";
import { reopenCourts } from "@/app/actions/closures";
import { closureWhen, type Closure } from "@/lib/closures";
import { useReadOnly } from "@/components/admin/ReadOnly";
import CloseCourtsModal from "./CloseCourtsModal";

type CourtOption = { id: string; name: string };

/** When a closure is, in the reader's language. */
export function useClosureWhen() {
  const intl = intlLocale(useLocale());
  return (c: Pick<Closure, "starts_at" | "ends_at">) => closureWhen(c, intl);
}

/** Which courts, in words. */
export function useClosureCourts(courts: CourtOption[]) {
  const t = useTranslations("closures");
  return (c: Pick<Closure, "court_ids">) =>
    c.court_ids === null
      ? t("allCourts")
      : courts
          .filter((k) => c.court_ids!.includes(k.id))
          .map((k) => k.name)
          .join(", ") || t("removedCourt");
}

/** Shown after closing: what happened. */
export function closedNotice(t: ReturnType<typeof useTranslations>, r: { cancelled: number; emailed: number }) {
  return [t("doneCancelled", { n: r.cancelled }), r.emailed ? t("doneEmailed", { n: r.emailed }) : ""]
    .filter(Boolean)
    .join(" ");
}

/** The courts page's list of closures that are on now or coming up. */
export default function ClosuresPanel({ closures, courts }: { closures: Closure[]; courts: CourtOption[] }) {
  const t = useTranslations("closures");
  const router = useRouter();
  const when = useClosureWhen();
  const which = useClosureCourts(courts);
  const { readOnly, hint } = useReadOnly();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now] = useState(() => Date.now());

  const reopen = (id: string) => {
    setBusy(id);
    setError(null);
    startTransition(async () => {
      const r = await reopenCourts(id);
      setBusy(null);
      if (r.error) {
        setError(t(`errors.${r.error}`));
        return;
      }
      setNotice(t("reopened"));
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="closures-title" className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="closures-title" className="text-lg font-medium text-ink-900">
            {t("listTitle")}
          </h2>
          <p className="mt-1 text-sm text-ink-600">{t("listHint")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setOpen(true);
          }}
          disabled={readOnly || courts.length === 0}
          title={hint}
          className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Ban size={15} aria-hidden="true" />
          {t("button")}
        </button>
      </div>

      {notice && (
        <p role="status" className="mb-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {closures.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-200 bg-white px-5 py-6 text-sm text-ink-600">
          {t("listEmpty")}
        </p>
      ) : (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white">
          {closures.map((c) => {
            const running = new Date(c.starts_at).getTime() <= now;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-600">
                  <Ban size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">
                    {when(c)}
                    {running && (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        {t("now")}
                      </span>
                    )}
                  </p>
                  <p className="text-[13px] text-ink-600">
                    {which(c)} · {t(`reasons.${c.reason}`)}
                    {c.note ? `: ${c.note}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => reopen(c.id)}
                  disabled={readOnly || busy === c.id}
                  title={hint ?? t("reopenHint")}
                  className="btn-ghost px-3 py-2 text-[13px]"
                >
                  {busy === c.id ? t("reopening") : t("reopen")}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <CloseCourtsModal
        open={open}
        onClose={() => setOpen(false)}
        courts={courts}
        onDone={(r) => {
          setOpen(false);
          setNotice(closedNotice(t, r));
          router.refresh();
        }}
      />
    </section>
  );
}
