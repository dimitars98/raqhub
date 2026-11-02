"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Court, Surface, Sport } from "@/types/database";
import Modal from "@/components/ui/Modal";
import { useRouter } from "@/i18n/navigation";
import {
  createCourts,
  removeCourtImage,
  toggleCourt,
  updateCourt,
  uploadCourtImage,
} from "@/app/[locale]/admin/courts/actions";
import { MAX_COURTS_AT_ONCE } from "@/lib/plans";
import { SPORTS, SURFACES_BY_SPORT } from "@/lib/labels";
import { useLabels } from "@/hooks/useLabels";
import { useReadOnly } from "@/components/admin/ReadOnly";
import SelectField from "@/components/ui/SelectField";
import { ImagePlus, Power, Trash2 } from "lucide-react";
import CourtArt from "@/components/courts/CourtArt";
import { resizeImage } from "@/lib/resizeImage";
import { ActionButton, EditButton } from "@/components/ui/ActionButton";
import { defaultColor, colorsFor, courtColor, swatchStyle, type CourtColor } from "@/lib/courtColors";

const TH =
  "text-left px-5 py-3 text-xs font-medium text-ink-400 whitespace-nowrap";

const EMPTY_FORM = {
  name: "",
  sport: "tennis" as Sport,
  surface: "clay" as Surface,
  is_indoor: false,
  price_per_hour: "",
  description: "",
  is_active: true,
  color: "terracotta" as CourtColor,
  /** How many identical courts to add (new courts only). */
  count: "1",
};

/** A photo picked in the form, uploaded when the court is saved. */
type Photo = { file: Blob | null; preview: string | null; remove: boolean };
const NO_PHOTO: Photo = { file: null, preview: null, remove: false };
/** After the browser has shrunk it, as the server action allows. */
const MAX_PHOTO_BYTES = 1024 * 1024;

interface Props {
  courts: Court[];
  clubId: string;
  /** Active courts the club's plan allows. Null = no limit. */
  maxCourts: number | null;
}

export default function CourtsClient({ courts: initial, maxCourts }: Props) {
  const t = useTranslations("adminCourts");
  const { readOnly, hint } = useReadOnly();
  const tb = useTranslations("billing");
  const tc = useTranslations("common");
  const [courts, setCourts] = useState(initial);
  const [sportFilter, setSportFilter] = useState<Sport | "all">("all");
  const [saveError, setSaveError] = useState(false);
  const [limitError, setLimitError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Court | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<Photo>(NO_PHOTO);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<"notImage" | "tooBig" | null>(null);
  // The court saved but its photo didn't upload.
  const [photoFailed, setPhotoFailed] = useState(false);
  const router = useRouter();

  const labels = useLabels();

  const activeCount = courts.filter((c) => c.is_active).length;
  const atLimit = maxCourts !== null && activeCount >= maxCourts;
  // How many new courts can be added in one go.
  const maxAtOnce = Math.max(
    1,
    maxCourts === null || !form.is_active
      ? MAX_COURTS_AT_ONCE
      : Math.min(MAX_COURTS_AT_ONCE, maxCourts - activeCount),
  );
  const count = Math.min(Math.max(parseInt(form.count, 10) || 1, 1), maxAtOnce);

  const filtered =
    sportFilter === "all"
      ? courts
      : courts.filter((c) => c.sport === sportFilter);

  const resetPhoto = () => {
    if (photo.preview) URL.revokeObjectURL(photo.preview);
    setPhoto(NO_PHOTO);
    setPhotoError(null);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    resetPhoto();
    setShowModal(true);
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith("image/")) return setPhotoError("notImage");
    setPhotoBusy(true);
    try {
      const small = await resizeImage(file);
      if (small.size > MAX_PHOTO_BYTES) return setPhotoError("tooBig");
      if (photo.preview) URL.revokeObjectURL(photo.preview);
      setPhoto({ file: small, preview: URL.createObjectURL(small), remove: false });
    } catch {
      // A format the browser can't open (e.g. some HEIC photos).
      setPhotoError("notImage");
    } finally {
      setPhotoBusy(false);
    }
  };

  /** Uploads or removes the photo of the courts just saved. False if it failed. */
  const savePhoto = async (ids: string[]) => {
    if (photo.file) {
      const fd = new FormData();
      fd.append("image", photo.file, "court.jpg");
      fd.append("courtIds", ids.join(","));
      const result = await uploadCourtImage(fd);
      if (!result.ok) return false;
      setCourts((prev) => prev.map((c) => (ids.includes(c.id) ? { ...c, image_url: result.url } : c)));
    } else if (photo.remove && ids.length === 1) {
      const result = await removeCourtImage(ids[0]);
      if (!result.ok) return false;
      setCourts((prev) => prev.map((c) => (c.id === ids[0] ? { ...c, image_url: null } : c)));
    }
    return true;
  };

  const openEdit = (c: Court) => {
    setEditing(c);
    setForm({
      name: c.name,
      sport: c.sport,
      surface: c.surface,
      is_indoor: c.is_indoor,
      price_per_hour: String(c.price_per_hour),
      description: c.description ?? "",
      is_active: c.is_active,
      color: courtColor(c),
      count: "1",
    });
    resetPhoto();
    setShowModal(true);
  };

  // When sport changes, reset surface to first valid option for that sport
  const handleSportChange = (sport: Sport) => {
    setForm((f) => ({
      ...f,
      sport,
      surface: SURFACES_BY_SPORT[sport][0],
      color: defaultColor(sport, SURFACES_BY_SPORT[sport][0]),
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveError(false);
    setLimitError(false);
    setPhotoFailed(false);

    const payload = {
      name: form.name,
      sport: form.sport,
      surface: form.surface,
      is_indoor: form.is_indoor,
      price_per_hour: parseFloat(form.price_per_hour),
      description: form.description || null,
      is_active: form.is_active,
      color: form.color,
    };

    let ids: string[] = [];
    try {
      const current = editing;
      if (current) {
        const result = await updateCourt(current.id, payload);
        if (!result.ok) {
          if (result.reason === "limit") setLimitError(true);
          else setSaveError(true);
          return;
        }
        const saved = result.data;
        setCourts((prev) => prev.map((c) => (c.id === current.id ? saved : c)));
        ids = [saved.id];
      } else {
        const result = await createCourts(payload, count);
        if (!result.ok) {
          if (result.reason === "limit") setLimitError(true);
          else setSaveError(true);
          return;
        }
        const saved = result.data;
        setCourts((prev) => [...saved, ...prev]);
        ids = saved.map((c) => c.id);
      }
      // The court is saved either way; a failed photo is said on the page.
      if (!(await savePhoto(ids))) setPhotoFailed(true);
      resetPhoto();
      setShowModal(false);
    } catch {
      setSaveError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (court: Court) => {
    const next = !court.is_active;
    setLimitError(false);
    const result = await toggleCourt(court.id, next);
    // Only update the list if the change was really saved.
    if (!result.ok) {
      if (result.reason === "limit") setLimitError(true);
      return;
    }
    setCourts((prev) =>
      prev.map((c) => (c.id === court.id ? { ...c, is_active: next } : c)),
    );
  };

  const openCourt = (c: Court) => router.push(`/admin/courts/${c.id}`);

  // Pieces shared by the phone cards and the table.
  const statusBadge = (c: Court) => (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
        c.is_active
          ? "bg-brand-100 text-brand-800"
          : "bg-ink-100 text-ink-600"
      }`}
    >
      {c.is_active ? t("active") : t("inactive")}
    </span>
  );

  // The buttons sit inside a clickable row/card, so they stop the click
  // from also opening the court page.
  const actions = (c: Court, variant: "table" | "card" = "table") => {
    const card = variant === "card";
    return (
      <div className={`flex items-center gap-2 ${card ? "w-full" : "justify-end"}`}>
        <EditButton
          title={hint}
          disabled={readOnly}
          large={card}
          className={card ? "flex-1" : ""}
          onClick={(e) => {
            e.stopPropagation();
            openEdit(c);
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {t("edit")}
        </EditButton>
        <ActionButton
          tone={c.is_active ? "danger" : "positive"}
          icon={<Power size={12} aria-hidden="true" />}
          title={hint}
          disabled={readOnly}
          large={card}
          className={card ? "flex-1" : ""}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(c);
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {c.is_active ? t("deactivate") : t("activate")}
        </ActionButton>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium text-ink-900">{t("title")}</h1>
          <p className="text-sm text-brand-600 mt-1">
            {courts.length} {t("total")}
            {maxCourts !== null && (
              <span className="text-ink-400">
                {" · "}
                {tb("courtsUsed", { used: activeCount, max: maxCourts })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={openAdd}
          disabled={readOnly || atLimit}
          title={atLimit ? tb("courtLimit", { max: maxCourts! }) : undefined}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("addCourt")}
        </button>
      </div>

      {(limitError || atLimit) && maxCourts !== null && (
        <p
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            limitError
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-ink-100 bg-white text-ink-600"
          }`}
        >
          {tb("courtLimit", { max: maxCourts })}
        </p>
      )}

      {photoFailed && (
        <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("photoError")}
        </p>
      )}

      {/* Sport filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
        {(["all", ...SPORTS] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSportFilter(s)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              sportFilter === s
                ? "border-brand-900 bg-brand-900 text-white"
                : "border-ink-100 bg-white text-ink-600 hover:bg-ink-50"
            }`}
          >
            {s === "all" ? t("allSports") : labels.sport(s)}
          </button>
        ))}
      </div>

      {/* Phones: one card per court; as many side by side as fit (each at least 280px). */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] md:hidden">
        {!filtered.length ? (
          <div className="col-span-full bg-white border border-ink-100 rounded-2xl text-center py-12 text-ink-400 text-sm">
            {t("noCourts")}
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              role="link"
              tabIndex={0}
              onClick={() => openCourt(c)}
              onKeyDown={(e) => {
                if (e.key === "Enter") openCourt(c);
              }}
              className={`overflow-hidden bg-white border border-ink-100 rounded-2xl shadow-[0_1px_2px_rgba(17,28,10,0.04)] cursor-pointer active:bg-ink-50 transition-colors ${
                c.is_active ? "" : "opacity-75"
              }`}
            >
              {/* The club's photo, or the court drawn in its colour */}
              <div className="relative h-24 w-full overflow-hidden">
                <CourtArt court={c} />
                <span className="absolute top-2.5 left-2.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                  {labels.sport(c.sport)}
                </span>
                <span className="absolute top-2.5 right-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink-900">
                  {labels.inOut(c.is_indoor)}
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-ink-900 truncate">
                    {c.name}
                  </div>
                  <div className="shrink-0">{statusBadge(c)}</div>
                </div>

                {c.description && (
                  <div className="mt-2 text-xs text-ink-400 line-clamp-2">
                    {c.description}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-ink-50 px-3 py-2">
                    <div className="text-[11px] text-ink-400">
                      {t("pricePerHour")}
                    </div>
                    <div className="text-base font-semibold text-ink-900">
                      €{c.price_per_hour}
                    </div>
                  </div>
                  <div className="rounded-xl bg-ink-50 px-3 py-2 min-w-0">
                    <div className="text-[11px] text-ink-400">{t("surface")}</div>
                    <div className="text-sm text-ink-900 truncate">
                      {labels.surface(c.surface)} ·{" "}
                      {labels.courtColor(courtColor(c))}
                    </div>
                  </div>
                </div>

                <div className="mt-4">{actions(c, "card")}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tablets and up: the table. */}
      <div className="hidden md:block bg-white border border-ink-100 rounded-2xl overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50">
              <th className={TH}>{t("name")}</th>
              <th className={TH}>{tc("sport")}</th>
              <th className={TH}>{t("surface")}</th>
              <th className={TH}>{t("type")}</th>
              <th className={TH}>{t("pricePerHour")}</th>
              <th className={TH}>{t("status")}</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {!filtered.length ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-12 text-ink-400 text-sm"
                >
                  {t("noCourts")}
                </td>
              </tr>
            ) : (
              filtered.map((c, i) => (
                <tr
                  key={c.id}
                  onClick={() => openCourt(c)}
                  className={`border-b border-ink-100 hover:bg-ink-50 transition-colors cursor-pointer ${
                    i === filtered.length - 1 ? "border-0" : ""
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="h-9 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5">
                        <CourtArt court={c} />
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-ink-900 whitespace-nowrap">
                          {c.name}
                        </div>
                        {c.description && (
                          <div className="text-xs text-ink-400 mt-0.5 truncate max-w-[180px]">
                            {c.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-ink-600 whitespace-nowrap">
                    {labels.sport(c.sport)}
                  </td>
                  <td className="px-5 py-3.5 text-ink-600">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full ring-1 ring-black/10"
                        style={swatchStyle(courtColor(c))}
                      />
                      {labels.surface(c.surface)} · {labels.courtColor(courtColor(c))}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-ink-600 whitespace-nowrap">
                    {labels.inOut(c.is_indoor)}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-ink-900 whitespace-nowrap">
                    €{c.price_per_hour}
                  </td>
                  <td className="px-5 py-3.5">{statusBadge(c)}</td>
                  <td className="px-5 py-3.5">{actions(c)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <Modal.Content>
          <Modal.Header>
            {editing ? t("editCourt") : t("addCourt")}
          </Modal.Header>
          <Modal.Body>
            <Modal.Grid>
              <Modal.Field label={t("name")} required>
                <input
                  className="input"
                  placeholder={count > 1 ? t("namePlaceholderMany") : "Court 1"}
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </Modal.Field>
              {!editing && (
                <Modal.Field label={t("howMany")}>
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxAtOnce}
                    value={form.count}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, count: e.target.value }))
                    }
                    onBlur={() => setForm((f) => ({ ...f, count: String(count) }))}
                  />
                </Modal.Field>
              )}
            </Modal.Grid>
            {!editing && count > 1 && form.name.trim() && (
              <p className="-mt-2 text-xs text-ink-600">
                {t("howManyHint", {
                  first: `${form.name.trim()} 1`,
                  last: `${form.name.trim()} ${count}`,
                })}
              </p>
            )}
            <Modal.Grid>
              {/* Sport selector */}
              <Modal.Field label={tc("sport")}>
                <SelectField
                  ariaLabel={tc("sport")}
                  value={form.sport}
                  onChange={(v) => handleSportChange(v as Sport)}
                  options={SPORTS.map((s) => ({ value: s, label: labels.sport(s) }))}
                />
              </Modal.Field>
              {/* Surface — filtered by sport */}
              <Modal.Field label={t("surface")}>
                <SelectField
                  ariaLabel={t("surface")}
                  value={form.surface}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, surface: v as Surface, color: defaultColor(f.sport, v as Surface) }))
                  }
                  options={SURFACES_BY_SPORT[form.sport].map((s) => ({ value: s, label: labels.surface(s) }))}
                />
              </Modal.Field>
            </Modal.Grid>
            {/* The court's real colour: drawn on the booking page */}
            <fieldset>
              <legend className="mb-1 block text-xs text-ink-400">{t("color")}</legend>
              <div role="radiogroup" aria-label={t("color")} className="flex flex-wrap gap-2">
                {colorsFor(form.surface).map((c) => {
                  const on = form.color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className={`inline-flex h-9 items-center gap-2 rounded-full border pr-3 pl-1.5 text-[13px] transition-colors ${
                        on ? "border-ink-900 bg-ink-50 font-medium text-ink-900" : "border-ink-200 text-ink-600 hover:border-ink-400"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="size-6 rounded-full ring-1 ring-black/10"
                        style={swatchStyle(c)}
                      />
                      {labels.courtColor(c)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {/* Photo: optional; without one the drawing above is shown */}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 block text-xs text-ink-400">{t("photo")}</legend>
              <div className="relative h-32 w-full overflow-hidden rounded-xl ring-1 ring-black/5">
                <CourtArt
                  court={{
                    sport: form.sport,
                    surface: form.surface,
                    color: form.color,
                    image_url: photo.preview ?? (photo.remove ? null : editing?.image_url),
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 text-[13px] font-medium text-ink-900 transition-colors hover:border-ink-400 focus-within:ring-2 focus-within:ring-brand-400 ${
                    photoBusy ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <ImagePlus size={15} aria-hidden="true" />
                  {photoBusy
                    ? t("photoReading")
                    : photo.preview || (!photo.remove && editing?.image_url)
                      ? t("changePhoto")
                      : t("uploadPhoto")}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={photoBusy}
                    onChange={(e) => {
                      pickPhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {(photo.preview || (!photo.remove && editing?.image_url)) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (photo.preview) URL.revokeObjectURL(photo.preview);
                      setPhoto({ file: null, preview: null, remove: true });
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t("removePhoto")}
                  </button>
                )}
              </div>
              <p role={photoError ? "alert" : undefined} className={`text-xs ${photoError ? "text-red-600" : "text-ink-400"}`}>
                {photoError === "notImage"
                  ? t("photoNotImage")
                  : photoError === "tooBig"
                    ? t("photoTooBig")
                    : t("photoHint")}
              </p>
            </fieldset>
            <Modal.Grid>
              <Modal.Field label={t("pricePerHour")}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="12"
                  value={form.price_per_hour}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price_per_hour: e.target.value }))
                  }
                />
              </Modal.Field>
              <Modal.Field label={t("type")}>
                <SelectField
                  ariaLabel={t("type")}
                  value={form.is_indoor ? "indoor" : "outdoor"}
                  onChange={(v) => setForm((f) => ({ ...f, is_indoor: v === "indoor" }))}
                  options={[
                    { value: "outdoor", label: labels.inOut(false) },
                    { value: "indoor", label: labels.inOut(true) },
                  ]}
                />
              </Modal.Field>
            </Modal.Grid>
            <Modal.Grid>
              <Modal.Field label={t("status")}>
                <SelectField
                  ariaLabel={t("status")}
                  value={form.is_active ? "active" : "inactive"}
                  onChange={(v) => setForm((f) => ({ ...f, is_active: v === "active" }))}
                  options={[
                    { value: "active", label: t("active") },
                    { value: "inactive", label: t("inactive") },
                  ]}
                />
              </Modal.Field>
            </Modal.Grid>
            <Modal.Field label={t("description")}>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder={t("descriptionPlaceholder")}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </Modal.Field>
            {saveError && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {t("saveError")}
              </p>
            )}
            {limitError && maxCourts !== null && (
              <p
                role="alert"
                className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                {tb("courtLimit", { max: maxCourts })}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <button
              onClick={() => setShowModal(false)}
              className="btn-secondary flex-1"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name || !form.price_per_hour || loading || photoBusy}
              className="btn-primary flex-1 disabled:opacity-40"
            >
              {loading
                ? t("saving")
                : editing
                  ? t("saveChanges")
                  : t("addCourt")}
            </button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </div>
  );
}
