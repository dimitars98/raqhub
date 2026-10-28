"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import Modal from "@/components/ui/Modal";
import SelectField from "@/components/ui/SelectField";
import { SPORTS } from "@/lib/labels";
import { useLabels } from "@/hooks/useLabels";
import { LEVELS } from "@/lib/leagues";
import { POINTS_CHOICES, type SocialEvent } from "@/lib/americano";
import type { SocialInput } from "@/app/[locale]/admin/americano/actions";
import { useReadOnly } from "@/components/admin/ReadOnly";

export type ClubCourt = { id: string; name: string; sport: string };

/** Create or edit an Americano evening. `onSave` returns an error key, if any. */
export default function SocialForm({
  initial,
  courts,
  onSave,
  onClose,
}: {
  initial?: SocialEvent;
  courts: ClubCourt[];
  onSave: (input: SocialInput) => Promise<{ error?: string }>;
  onClose: () => void;
}) {
  const t = useTranslations("americano");
  const labels = useLabels();
  const { readOnly, hint } = useReadOnly();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const started = !!initial && initial.status !== "open";
  const sportsHere = SPORTS.filter((s) => courts.some((c) => c.sport === s));
  const firstSport = initial?.sport ?? (sportsHere.includes("padel") ? "padel" : (sportsHere[0] ?? "padel"));
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    sport: firstSport as string,
    format: initial?.format ?? "americano",
    date: initial ? format(new Date(initial.starts_at), "yyyy-MM-dd") : "",
    from: initial ? format(new Date(initial.starts_at), "HH:mm") : "19:00",
    to: initial ? format(new Date(initial.ends_at), "HH:mm") : "21:00",
    court_ids: initial?.court_ids ?? courts.filter((c) => c.sport === firstSport).map((c) => c.id),
    points: String(initial?.points_per_match ?? 24),
    max: String(initial?.max_players ?? 16),
    fee: initial?.entry_fee != null ? String(initial.entry_fee) : "",
    level_min: initial?.level_min != null ? String(initial.level_min) : "",
    level_max: initial?.level_max != null ? String(initial.level_max) : "",
    description: initial?.description ?? "",
  });
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      // A new sport: its courts.
      if (key === "sport") next.court_ids = courts.filter((c) => c.sport === value).map((c) => c.id);
      return next;
    });
  const toggleCourt = (id: string) =>
    setForm((f) => ({
      ...f,
      court_ids: f.court_ids.includes(id) ? f.court_ids.filter((c) => c !== id) : [...f.court_ids, id],
    }));

  const shown = courts.filter((c) => c.sport === form.sport);
  const levelOptions = [
    { value: "", label: t("form.anyLevel") },
    ...LEVELS.map((l) => ({ value: String(l), label: l.toFixed(1) })),
  ];

  const save = () => {
    setError(null);
    if (readOnly) return setError(hint ?? null);
    if (!form.date) return setError(t("errors.date"));
    // The club's local time (the browser's).
    const startsAt = new Date(`${form.date}T${form.from}`);
    const endsAt = new Date(`${form.date}T${form.to}`);
    startTransition(async () => {
      const result = await onSave({
        name: form.name,
        sport: form.sport,
        format: form.format === "mexicano" ? "mexicano" : "americano",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        // In the order the club's courts are listed: the first is court 1.
        court_ids: courts.map((c) => c.id).filter((id) => form.court_ids.includes(id)),
        points_per_match: Number(form.points),
        max_players: Number(form.max),
        entry_fee: form.fee === "" ? null : Number(form.fee),
        level_min: form.level_min === "" ? null : Number(form.level_min),
        level_max: form.level_max === "" ? null : Number(form.level_max),
        description: form.description,
      });
      if (result.error) setError(t(`errors.${result.error}`));
      else onClose();
    });
  };

  return (
    <Modal open onClose={onClose}>
      <Modal.Content className="max-h-[90vh] max-w-lg overflow-y-auto">
        <Modal.Header>{initial ? t("edit") : t("new")}</Modal.Header>
        <Modal.Body>
          {error && (
            <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
          <Modal.Field label={t("form.name")} required>
            <input
              className="input"
              placeholder={t("form.namePlaceholder")}
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
            />
          </Modal.Field>

          <div role="radiogroup" aria-label={t("form.format")} className="grid grid-cols-2 gap-2">
            {(["americano", "mexicano"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={form.format === f}
                disabled={started}
                onClick={() => set("format")(f)}
                className={`rounded-xl border p-3 text-left disabled:opacity-60 ${
                  form.format === f ? "border-ink-900 bg-[#fbfdf6]" : "border-ink-100 hover:border-ink-200"
                }`}
              >
                <span className="block text-sm font-semibold text-ink-900">{t(`formats.${f}`)}</span>
                <span className="mt-0.5 block text-xs text-ink-600">{t(`formats.${f}Hint`)}</span>
              </button>
            ))}
          </div>

          <Modal.Grid>
            <Modal.Field label={t("form.sport")}>
              <SelectField
                ariaLabel={t("form.sport")}
                value={form.sport}
                onChange={set("sport")}
                disabled={started}
                options={(sportsHere.length ? sportsHere : SPORTS).map((s) => ({ value: s, label: labels.sport(s) }))}
              />
            </Modal.Field>
            <Modal.Field label={t("form.date")} required>
              <input className="input" type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} />
            </Modal.Field>
          </Modal.Grid>
          <Modal.Grid>
            <Modal.Field label={t("form.from")}>
              <input className="input" type="time" step={900} value={form.from} onChange={(e) => set("from")(e.target.value)} />
            </Modal.Field>
            <Modal.Field label={t("form.to")}>
              <input className="input" type="time" step={900} value={form.to} onChange={(e) => set("to")(e.target.value)} />
            </Modal.Field>
          </Modal.Grid>

          <Modal.Field label={t("form.courts")}>
            {shown.length === 0 ? (
              <p className="text-sm text-ink-400">{t("form.noCourts")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {shown.map((c) => {
                  const on = form.court_ids.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCourt(c.id)}
                      className={`h-9 rounded-full border px-3.5 text-[13px] font-medium ${
                        on ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Modal.Field>
          <p className="-mt-1 text-xs text-ink-400">{t("form.courtsHint")}</p>

          <Modal.Grid>
            <Modal.Field label={t("form.points")}>
              <SelectField
                ariaLabel={t("form.points")}
                value={form.points}
                onChange={set("points")}
                options={[...new Set([...POINTS_CHOICES, Number(form.points)])]
                  .sort((a, b) => a - b)
                  .map((n) => ({ value: String(n), label: t("form.pointsOption", { n }) }))}
              />
            </Modal.Field>
            <Modal.Field label={t("form.maxPlayers")}>
              <input
                className="input"
                type="number"
                min="4"
                max="64"
                value={form.max}
                onChange={(e) => set("max")(e.target.value)}
              />
            </Modal.Field>
          </Modal.Grid>
          <p className="-mt-1 text-xs text-ink-400">
            {t("form.playersHint", { n: Math.max(1, form.court_ids.length) * 4 })}
          </p>
          <Modal.Grid>
            <Modal.Field label={t("form.levelMin")}>
              <SelectField ariaLabel={t("form.levelMin")} value={form.level_min} onChange={set("level_min")} options={levelOptions} />
            </Modal.Field>
            <Modal.Field label={t("form.levelMax")}>
              <SelectField ariaLabel={t("form.levelMax")} value={form.level_max} onChange={set("level_max")} options={levelOptions} />
            </Modal.Field>
          </Modal.Grid>
          <Modal.Field label={t("form.entryFee")}>
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={form.fee}
              onChange={(e) => set("fee")(e.target.value)}
            />
          </Modal.Field>
          <Modal.Field label={t("form.description")}>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder={t("form.descriptionPlaceholder")}
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
            />
          </Modal.Field>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            {t("cancel")}
          </button>
          <button type="button" onClick={save} disabled={pending} className="btn-primary flex-1 justify-center disabled:opacity-50">
            {pending ? t("saving") : t("save")}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
