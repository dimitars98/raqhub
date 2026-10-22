"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { addPlayer, updatePlayer, type PlayerInput } from "@/app/[locale]/admin/groups/actions";
import type { GroupPlayer } from "@/types/database";

/** Add someone to a group's list (or its waiting list), or edit them. */
export default function PlayerModal({
  groupId,
  player,
  full,
  defaultPrice,
  onClose,
  onSaved,
}: {
  groupId: string;
  player?: GroupPlayer;
  /** The group is full: new players go on the waiting list unless the club says otherwise. */
  full: boolean;
  defaultPrice: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations("groups.player");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(full);
  const [form, setForm] = useState({
    name: player?.name ?? "",
    age: player?.age != null ? String(player.age) : "",
    contact_name: player?.contact_name ?? "",
    email: player?.email ?? "",
    phone: player?.phone ?? "",
    monthly_price: player?.monthly_price != null ? String(Number(player.monthly_price)) : "",
    notes: player?.notes ?? "",
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = () => {
    setError(null);
    const input: PlayerInput = {
      name: form.name,
      age: form.age ? Number(form.age) : null,
      contact_name: form.contact_name,
      email: form.email,
      phone: form.phone,
      monthly_price: form.monthly_price === "" ? null : Number(form.monthly_price.replace(",", ".")),
      notes: form.notes,
    };
    startTransition(async () => {
      const result = player
        ? await updatePlayer(groupId, player.id, input)
        : await addPlayer(groupId, input, waiting);
      if (result.error) {
        setError(t(`errors.${result.error}`));
        return;
      }
      onSaved(player ? t("saved") : waiting ? t("addedWaiting", { name: input.name.trim() }) : t("added", { name: input.name.trim() }));
      onClose();
    });
  };

  return (
    <Modal open onClose={onClose}>
      <Modal.Content className="max-h-[90vh] max-w-lg overflow-y-auto">
        <Modal.Header>{player ? t("editTitle") : t("addTitle")}</Modal.Header>
        <Modal.Body>
          {error && (
            <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          <Modal.Grid>
            <Modal.Field label={t("name")} required htmlFor="gp-name">
              <input id="gp-name" className="input" value={form.name} onChange={set("name")} maxLength={80} autoFocus />
            </Modal.Field>
            <Modal.Field label={t("age")} htmlFor="gp-age">
              <input id="gp-age" className="input" type="number" min={3} max={99} value={form.age} onChange={set("age")} />
            </Modal.Field>
          </Modal.Grid>
          <Modal.Field label={t("contactName")} htmlFor="gp-contactName">
            <input id="gp-contactName"
              className="input"
              value={form.contact_name}
              onChange={set("contact_name")}
              placeholder={t("contactPlaceholder")}
              maxLength={80}
            />
          </Modal.Field>
          <Modal.Grid>
            <Modal.Field label={t("email")} htmlFor="gp-email">
              <input id="gp-email" className="input" type="email" value={form.email} onChange={set("email")} maxLength={200} />
            </Modal.Field>
            <Modal.Field label={t("phone")} htmlFor="gp-phone">
              <input id="gp-phone" className="input" type="tel" value={form.phone} onChange={set("phone")} maxLength={40} />
            </Modal.Field>
          </Modal.Grid>
          <p className="-mt-1 text-xs text-ink-600">{t("emailHint")}</p>
          <Modal.Field label={t("price")} htmlFor="gp-price">
            <input id="gp-price"
              className="input"
              inputMode="decimal"
              value={form.monthly_price}
              placeholder={`€${defaultPrice}`}
              onChange={(e) => setForm((f) => ({ ...f, monthly_price: e.target.value.replace(/[^\d.,]/g, "") }))}
            />
          </Modal.Field>
          <p className="-mt-1 text-xs text-ink-600">{t("priceHint")}</p>
          <Modal.Field label={t("notes")} htmlFor="gp-notes">
            <textarea id="gp-notes" className="input resize-none" rows={2} value={form.notes} onChange={set("notes")} maxLength={500} />
          </Modal.Field>
          {!player && (
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input
                type="checkbox"
                className="size-[18px] accent-brand-600"
                checked={waiting}
                onChange={(e) => setWaiting(e.target.checked)}
              />
              {full ? t("waitingFull") : t("waiting")}
            </label>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !form.name.trim()}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {pending ? t("saving") : player ? t("save") : t("add")}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
