"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import SelectField from "@/components/ui/SelectField";
import { SPORTS } from "@/lib/labels";
import { useLabels } from "@/hooks/useLabels";
import { BOX_SIZES, LEVELS, ROUND_WEEKS, type League } from "@/lib/leagues";
import type { LeagueInput } from "@/app/[locale]/admin/leagues/actions";
import { useReadOnly } from "@/components/admin/ReadOnly";

/** Create or edit a league. `onSave` returns an error key, if any. */
export default function LeagueForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: League;
  onSave: (input: LeagueInput) => Promise<{ error?: string }>;
  onClose: () => void;
}) {
  const t = useTranslations("leagues");
  const labels = useLabels();
  const { readOnly, hint } = useReadOnly();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Sport and singles/pairs are fixed once the first round has boxes.
  const started = !!initial && initial.status !== "open";
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    sport: initial?.sport ?? "padel",
    team_size: String(initial?.team_size ?? 2),
    box_size: String(initial?.box_size ?? 4),
    round_weeks: String(initial?.round_weeks ?? 3),
    move_count: String(initial?.move_count ?? 1),
    starts_on: initial?.starts_on ?? "",
    max_entries: String(initial?.max_entries ?? 24),
    entry_fee: initial?.entry_fee != null ? String(initial.entry_fee) : "",
    level_min: initial?.level_min != null ? String(initial.level_min) : "",
    level_max: initial?.level_max != null ? String(initial.level_max) : "",
    description: initial?.description ?? "",
  });
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Padel is played in pairs, tennis usually alone: a sensible default.
      if (key === "sport" && !initial) next.team_size = value === "tennis" ? "1" : "2";
      return next;
    });

  const level = (v: string) => (v === "" ? null : Number(v));
  const levelOptions = [
    { value: "", label: t("form.anyLevel") },
    ...LEVELS.map((l) => ({ value: String(l), label: l.toFixed(1) })),
  ];

  const save = () => {
    setError(null);
    if (readOnly) return setError(hint ?? null);
    startTransition(async () => {
      const result = await onSave({
        name: form.name,
        sport: form.sport,
        team_size: Number(form.team_size),
        box_size: Number(form.box_size),
        round_weeks: Number(form.round_weeks),
        move_count: Number(form.move_count),
        starts_on: form.starts_on,
        max_entries: Number(form.max_entries),
        entry_fee: form.entry_fee === "" ? null : Number(form.entry_fee),
        level_min: level(form.level_min),
        level_max: level(form.level_max),
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
          <Modal.Grid>
            <Modal.Field label={t("form.sport")}>
              <SelectField
                ariaLabel={t("form.sport")}
                value={form.sport}
                onChange={set("sport")}
                disabled={started}
                options={SPORTS.map((s) => ({ value: s, label: labels.sport(s) }))}
              />
            </Modal.Field>
            <Modal.Field label={t("form.format")}>
              <SelectField
                ariaLabel={t("form.format")}
                value={form.team_size}
                onChange={set("team_size")}
                disabled={started}
                options={[
                  { value: "2", label: t("form.pairs") },
                  { value: "1", label: t("form.singles") },
                ]}
              />
            </Modal.Field>
          </Modal.Grid>
          <Modal.Grid>
            <Modal.Field label={t("form.startsOn")} required>
              <input
                className="input"
                type="date"
                value={form.starts_on}
                onChange={(e) => set("starts_on")(e.target.value)}
              />
            </Modal.Field>
            <Modal.Field label={t("form.roundWeeks")}>
              <SelectField
                ariaLabel={t("form.roundWeeks")}
                value={form.round_weeks}
                onChange={set("round_weeks")}
                options={ROUND_WEEKS.map((w) => ({ value: String(w), label: t("form.weeks", { n: w }) }))}
              />
            </Modal.Field>
          </Modal.Grid>
          <Modal.Grid>
            <Modal.Field label={t("form.boxSize")}>
              <SelectField
                ariaLabel={t("form.boxSize")}
                value={form.box_size}
                onChange={set("box_size")}
                options={BOX_SIZES.map((n) => ({
                  value: String(n),
                  label: t("form.boxSizeOption", { n, matches: n - 1 }),
                }))}
              />
            </Modal.Field>
            <Modal.Field label={t("form.moveCount")}>
              <SelectField
                ariaLabel={t("form.moveCount")}
                value={form.move_count}
                onChange={set("move_count")}
                options={[0, 1, 2].map((n) => ({ value: String(n), label: t("form.moveOption", { n }) }))}
              />
            </Modal.Field>
          </Modal.Grid>
          <p className="-mt-1 text-xs text-ink-400">{t("form.boxHint")}</p>
          <Modal.Grid>
            <Modal.Field label={t("form.levelMin")}>
              <SelectField ariaLabel={t("form.levelMin")} value={form.level_min} onChange={set("level_min")} options={levelOptions} />
            </Modal.Field>
            <Modal.Field label={t("form.levelMax")}>
              <SelectField ariaLabel={t("form.levelMax")} value={form.level_max} onChange={set("level_max")} options={levelOptions} />
            </Modal.Field>
          </Modal.Grid>
          <Modal.Grid>
            <Modal.Field label={form.team_size === "2" ? t("form.maxPairs") : t("form.maxPlayers")}>
              <input
                className="input"
                type="number"
                min="4"
                max="96"
                value={form.max_entries}
                onChange={(e) => set("max_entries")(e.target.value)}
              />
            </Modal.Field>
            <Modal.Field label={t("form.entryFee")}>
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
          <p className="-mt-1 text-xs text-ink-400">{t("form.entryFeeHint")}</p>
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
