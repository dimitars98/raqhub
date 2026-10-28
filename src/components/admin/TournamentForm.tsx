"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { SPORTS } from "@/lib/labels";
import { MAX_ENTRIES_CHOICES } from "@/lib/tournament";
import { useLabels } from "@/hooks/useLabels";
import type { Tournament } from "@/types/database";
import type { TournamentInput } from "@/app/[locale]/admin/tournaments/actions";
import { useReadOnly } from "@/components/admin/ReadOnly";
import SelectField from "@/components/ui/SelectField";

/** Create or edit a tournament. `onSave` returns an error key, if any. */
export default function TournamentForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Tournament;
  onSave: (input: TournamentInput) => Promise<{ error?: string }>;
  onClose: () => void;
}) {
  const t = useTranslations("tournaments");
  const { readOnly, hint } = useReadOnly();
  const labels = useLabels();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    sport: initial?.sport ?? "tennis",
    team_size: String(initial?.team_size ?? 1),
    starts_on: initial?.starts_on ?? "",
    max_entries: String(initial?.max_entries ?? 16),
    entry_fee: initial?.entry_fee != null ? String(initial.entry_fee) : "",
    description: initial?.description ?? "",
  });
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Padel is played in pairs: a sensible default for a new tournament.
      if (key === "sport" && !initial) next.team_size = value === "tennis" ? "1" : "2";
      return next;
    });

  // Keep a custom number of places that isn't in the usual list.
  const placeChoices = Array.from(new Set([...MAX_ENTRIES_CHOICES, Number(form.max_entries)])).sort(
    (a, b) => a - b,
  );

  const save = () => {
    setError(null);
    if (readOnly) return setError(hint ?? null);
    startTransition(async () => {
      const result = await onSave({
        name: form.name,
        sport: form.sport,
        starts_on: form.starts_on,
        max_entries: Number(form.max_entries),
        entry_fee: form.entry_fee === "" ? null : Number(form.entry_fee),
        description: form.description,
        team_size: Number(form.team_size),
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
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
          )}
          <Modal.Field label={t("fields.name")} required>
            <input
              className="input"
              placeholder={t("fields.namePlaceholder")}
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
            />
          </Modal.Field>
          <Modal.Grid>
            <Modal.Field label={t("fields.sport")}>
              <SelectField
                ariaLabel={t("fields.sport")}
                value={form.sport}
                onChange={(v) => set("sport")(v)}
                options={SPORTS.map((s) => ({ value: s, label: labels.sport(s) }))}
              />
            </Modal.Field>
            <Modal.Field label={t("fields.date")} required>
              <input
                className="input"
                type="date"
                value={form.starts_on}
                onChange={(e) => set("starts_on")(e.target.value)}
              />
            </Modal.Field>
          </Modal.Grid>
          <Modal.Field label={t("fields.format")}>
            <SelectField
              ariaLabel={t("fields.format")}
              value={form.team_size}
              onChange={(v) => set("team_size")(v)}
              options={[
                { value: "1", label: t("fields.singles") },
                { value: "2", label: t("fields.pairs") },
              ]}
            />
          </Modal.Field>
          <Modal.Grid>
            <Modal.Field label={form.team_size === "2" ? t("fields.maxPairs") : t("fields.maxEntries")}>
              <SelectField
                ariaLabel={t("fields.maxEntries")}
                value={String(form.max_entries)}
                onChange={(v) => set("max_entries")(v)}
                options={placeChoices.map((n) => ({ value: String(n), label: String(n) }))}
              />
            </Modal.Field>
            <Modal.Field label={t("fields.entryFee")}>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.entry_fee}
                onChange={(e) => set("entry_fee")(e.target.value)}
              />
            </Modal.Field>
          </Modal.Grid>
          <p className="-mt-1 text-xs text-ink-400">{t("fields.entryFeeHint")}</p>
          <Modal.Field label={t("fields.description")}>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder={t("fields.descriptionPlaceholder")}
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
            />
          </Modal.Field>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {pending ? t("saving") : t("save")}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
