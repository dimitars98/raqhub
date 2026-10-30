"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { addDays, format } from "date-fns";
import { Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import SelectField from "@/components/ui/SelectField";
import { useReadOnly } from "@/components/admin/ReadOnly";
import { closeCourts, previewClosure, type ClosureInput, type ClosurePreview } from "@/app/actions/closures";
import { CLOSURE_REASONS, type ClosureReason } from "@/lib/closures";

type CourtOption = { id: string; name: string };

// Half hours from 06:00 to 24:00, for "Some hours".
const TIMES = Array.from({ length: 37 }, (_, i) => {
  const min = 6 * 60 + i * 30;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
});

const at = (day: string, time: string) =>
  time === "24:00" ? addDays(new Date(`${day}T00:00`), 1) : new Date(`${day}T${time}`);

/** The next half hour from now, as "HH:MM" (at most 22:00). */
function nextHalfHour() {
  const now = new Date();
  const min = Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 30) * 30, 22 * 60);
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * "Close courts": pick courts, a time and a reason. Shows what it would
 * cancel before the admin confirms. Opened from the timetable and the
 * courts page.
 */
export default function CloseCourtsModal({
  open,
  onClose,
  courts,
  day,
  courtId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  courts: CourtOption[];
  /** The day it starts on (yyyy-MM-dd); today when not given. */
  day?: string;
  /** Start with only this court picked; otherwise all. */
  courtId?: string;
  onDone: (r: { cancelled: number; emailed: number }) => void;
}) {
  if (!open) return null;
  // Mounted fresh each time it opens, so the form starts clean.
  return <Form onClose={onClose} courts={courts} day={day} courtId={courtId} onDone={onDone} />;
}

function Form({
  onClose,
  courts,
  day,
  courtId,
  onDone,
}: {
  onClose: () => void;
  courts: CourtOption[];
  day?: string;
  courtId?: string;
  onDone: (r: { cancelled: number; emailed: number }) => void;
}) {
  const t = useTranslations("closures");
  const { readOnly, hint } = useReadOnly();
  const today = format(new Date(), "yyyy-MM-dd");
  const first = day && day > today ? day : today;

  const [all, setAll] = useState(!courtId);
  const [picked, setPicked] = useState<string[]>(courtId ? [courtId] : []);
  const [mode, setMode] = useState<"days" | "hours">("days");
  const [fromDay, setFromDay] = useState(first);
  const [toDay, setToDay] = useState(first);
  const [hoursDay, setHoursDay] = useState(first);
  const [fromTime, setFromTime] = useState(first === today ? nextHalfHour() : "08:00");
  const [toTime, setToTime] = useState("24:00");
  const [reason, setReason] = useState<ClosureReason>("maintenance");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<{ key: string; value: ClosurePreview | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const startsAt = mode === "days" ? at(fromDay, "00:00") : at(hoursDay, fromTime);
  const endsAt = mode === "days" ? at(toDay, "24:00") : at(hoursDay, toTime);
  const timesOk = !Number.isNaN(startsAt.getTime()) && endsAt > startsAt && endsAt > new Date();
  const courtIds = all ? null : picked;
  const courtsOk = all || picked.length > 0;

  const input: ClosureInput = {
    courtIds,
    startsAt: timesOk ? startsAt.toISOString() : "",
    endsAt: timesOk ? endsAt.toISOString() : "",
    reason,
    note,
  };
  const key = JSON.stringify([courtIds, input.startsAt, input.endsAt]);

  // What it would cancel, looked up again whenever the courts or times change.
  useEffect(() => {
    if (!timesOk || !courtsOk) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      previewClosure({ courtIds, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), reason, note: "" }).then(
        (r) => {
          if (!cancelled) setPreview({ key, value: "error" in r ? null : r });
        },
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // The key holds the courts and times; reason doesn't change the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, timesOk, courtsOk]);

  const current = preview?.key === key ? preview.value : undefined;
  const count = current ? current.bookings + current.groups : 0;

  const toggle = (id: string) => {
    setAll(false);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const submit = () => {
    setError(null);
    if (!courtsOk) return setError(t("errors.noCourts"));
    if (!timesOk) return setError(endsAt <= startsAt ? t("errors.order") : t("errors.passed"));
    startSaving(async () => {
      const r = await closeCourts(input);
      if ("error" in r) {
        setError(t(`errors.${r.error}`));
        return;
      }
      onDone(r);
    });
  };

  const chip = (on: boolean) =>
    `inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
      on ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-ink-400"
    }`;

  return (
    <Modal open onClose={onClose}>
      <Modal.Content className="max-w-lg">
        <Modal.Header>{t("title")}</Modal.Header>
        <Modal.Body>
          <p className="text-[13px] leading-relaxed text-ink-600">{t("intro")}</p>

          {/* Courts */}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-xs text-ink-400">{t("courts")}</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={all} onClick={() => setAll(true)} className={chip(all)}>
                {all && <Check size={14} aria-hidden="true" />}
                {t("allCourts")}
              </button>
              {courts.map((c) => {
                const on = !all && picked.includes(c.id);
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => toggle(c.id)} className={chip(on)}>
                    {on && <Check size={14} aria-hidden="true" />}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* When */}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-xs text-ink-400">{t("when")}</legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-xl bg-ink-50 p-1">
              {(["days", "hours"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`h-9 rounded-lg text-[13px] font-medium transition-colors ${
                    mode === m ? "bg-white text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  {m === "days" ? t("wholeDays") : t("someHours")}
                </button>
              ))}
            </div>
            {mode === "days" ? (
              <div className="grid grid-cols-2 gap-3">
                <Modal.Field label={t("fromDay")} htmlFor="close-from">
                  <input
                    id="close-from"
                    type="date"
                    min={today}
                    value={fromDay}
                    onChange={(e) => {
                      setFromDay(e.target.value);
                      if (e.target.value > toDay) setToDay(e.target.value);
                    }}
                    className="input"
                  />
                </Modal.Field>
                <Modal.Field label={t("toDay")} htmlFor="close-to">
                  <input
                    id="close-to"
                    type="date"
                    min={fromDay}
                    value={toDay}
                    onChange={(e) => setToDay(e.target.value)}
                    className="input"
                  />
                </Modal.Field>
              </div>
            ) : (
              <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3">
                <Modal.Field label={t("date")} htmlFor="close-day">
                  <input
                    id="close-day"
                    type="date"
                    min={today}
                    value={hoursDay}
                    onChange={(e) => setHoursDay(e.target.value)}
                    className="input"
                  />
                </Modal.Field>
                <Modal.Field label={t("fromTime")} htmlFor="close-from-time">
                  <SelectField
                    id="close-from-time"
                    value={fromTime}
                    onChange={setFromTime}
                    options={TIMES.slice(0, -1).map((x) => ({ value: x, label: x }))}
                  />
                </Modal.Field>
                <Modal.Field label={t("toTime")} htmlFor="close-to-time">
                  <SelectField
                    id="close-to-time"
                    value={toTime}
                    onChange={setToTime}
                    options={TIMES.slice(1).map((x) => ({ value: x, label: x }))}
                  />
                </Modal.Field>
              </div>
            )}
          </fieldset>

          {/* Why */}
          <Modal.Field label={t("reason")} htmlFor="close-reason">
            <SelectField
              id="close-reason"
              value={reason}
              onChange={(v) => setReason(v as ClosureReason)}
              options={CLOSURE_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) }))}
            />
          </Modal.Field>
          <Modal.Field label={t("note")} htmlFor="close-note">
            <input
              id="close-note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              className="input"
            />
          </Modal.Field>

          {/* What it cancels */}
          {timesOk && courtsOk && (
            <div
              aria-live="polite"
              className={`rounded-xl px-4 py-3 text-[13px] leading-relaxed ${
                count > 0 ? "bg-amber-50 text-amber-900" : "bg-ink-50 text-ink-600"
              }`}
            >
              {current === undefined ? (
                t("checking")
              ) : current === null ? (
                t("previewFailed")
              ) : count === 0 ? (
                t("previewNone")
              ) : (
                <>
                  <span className="font-semibold">
                    {[
                      current.bookings ? t("previewBookings", { n: current.bookings }) : "",
                      current.groups ? t("previewGroups", { n: current.groups }) : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {current.names.length > 0 && (
                    <span className="block">{current.names.join(", ")}</span>
                  )}
                  <span className="mt-1 block">{t("previewTold")}</span>
                </>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={readOnly || saving}
            title={hint}
            className={count > 0 ? "btn-danger flex-1" : "btn-primary flex-1"}
          >
            {saving ? t("saving") : count > 0 ? t("confirmCancel", { n: count }) : t("confirm")}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
