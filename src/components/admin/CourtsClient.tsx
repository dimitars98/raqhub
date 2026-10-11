"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";
import type { Court, Surface, Sport } from "@/types/database";
import Modal from "@/components/ui/Modal";
import { useRouter } from "@/i18n/navigation";
import {
  createCourt,
  toggleCourt,
  updateCourt,
} from "@/app/[locale]/admin/courts/actions";

const SURFACES_BY_SPORT: Record<Sport, Surface[]> = {
  tennis: ["clay", "hard", "grass", "artificial_grass", "carpet"],
  padel: ["artificial_grass", "carpet", "hard"],
  pickleball: ["hard", "concrete", "acrylic", "carpet"],
};

const EMPTY_FORM = {
  name: "",
  sport: "tennis" as Sport,
  surface: "clay" as Surface,
  is_indoor: false,
  price_per_hour: "",
  description: "",
  is_active: true,
};

interface Props {
  courts: Court[];
  clubId: string;
}

export default function CourtsClient({ courts: initial, clubId }: Props) {
  const t = useTranslations("adminCourts");
  const [courts, setCourts] = useState(initial);
  const [sportFilter, setSportFilter] = useState<Sport | "all">("all");
  const [saveError, setSaveError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Court | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const SPORT_LABEL: Record<Sport, string> = {
    tennis: t("tennis"),
    padel: t("padel"),
    pickleball: t("pickleball"),
  };

  const SURFACE_LABEL: Record<string, string> = {
    clay: t("clay"),
    hard: t("hard"),
    grass: t("grass"),
    artificial_grass: t("artificialGrass"),
    carpet: t("carpet"),
    concrete: t("concrete"),
    acrylic: t("acrylic"),
  };

  const filtered =
    sportFilter === "all"
      ? courts
      : courts.filter((c) => c.sport === sportFilter);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
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
    });
    setShowModal(true);
  };

  // When sport changes, reset surface to first valid option for that sport
  const handleSportChange = (sport: Sport) => {
    setForm((f) => ({
      ...f,
      sport,
      surface: SURFACES_BY_SPORT[sport][0],
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveError(false);

    const payload = {
      name: form.name,
      sport: form.sport,
      surface: form.surface,
      is_indoor: form.is_indoor,
      price_per_hour: parseFloat(form.price_per_hour),
      description: form.description || null,
      is_active: form.is_active,
    };

    try {
      const current = editing;
      const result = current
        ? await updateCourt(current.id, payload)
        : await createCourt(payload);

      if (!result.ok) {
        setSaveError(true);
        return;
      }

      const saved = result.data;
      setCourts((prev) =>
        current
          ? prev.map((c) => (c.id === current.id ? saved : c))
          : [saved, ...prev],
      );
      setShowModal(false);
    } catch {
      setSaveError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (court: Court) => {
    const next = !court.is_active;
    const result = await toggleCourt(court.id, next);
    // Only update the list if the change was really saved.
    if (!result.ok) return;
    setCourts((prev) =>
      prev.map((c) => (c.id === court.id ? { ...c, is_active: next } : c)),
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-ink-900">{t("title")}</h1>
          <p className="text-sm text-brand-600 mt-1">
            {courts.length} {t("total")}
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          {t("addCourt")}
        </button>
      </div>

      {/* Sport filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "tennis", "padel", "pickleball"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSportFilter(s)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sportFilter === s
                ? "bg-brand-600 text-white"
                : "bg-white border border-ink-100 text-ink-600 hover:bg-ink-50"
            }`}
          >
            {s === "all"
              ? t("allSports")
              : t(s as "tennis" | "padel" | "pickleball")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-ink-400">
                {t("name")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-ink-400">
                Sport
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-ink-400">
                {t("surface")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-ink-400">
                {t("type")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-ink-400">
                {t("pricePerHour")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-ink-400">
                {t("status")}
              </th>
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
                  onClick={() => router.push(`/admin/courts/${c.id}`)}
                  className={`border-b border-ink-100 hover:bg-ink-50 transition-colors cursor-pointer ${
                    i === filtered.length - 1 ? "border-0" : ""
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-ink-900">{c.name}</div>
                    {c.description && (
                      <div className="text-xs text-ink-400 mt-0.5 truncate max-w-[180px]">
                        {c.description}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-ink-600">
                    {SPORT_LABEL[c.sport]}
                  </td>
                  <td className="px-5 py-3.5 text-ink-600">
                    {SURFACE_LABEL[c.surface]}
                  </td>
                  <td className="px-5 py-3.5 text-ink-600">
                    {c.is_indoor ? t("indoor") : t("outdoor")}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-ink-900">
                    €{c.price_per_hour}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        c.is_active
                          ? "bg-brand-100 text-brand-800"
                          : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {c.is_active ? t("active") : t("inactive")}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(c);
                        }}
                        className="text-xs text-ink-400 hover:text-ink-900 transition-colors"
                      >
                        {t("edit")}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggle(c);
                        }}
                        className={`text-xs transition-colors ${
                          c.is_active
                            ? "text-red-400 hover:text-red-600"
                            : "text-brand-600 hover:text-brand-800"
                        }`}
                      >
                        {c.is_active ? t("deactivate") : t("activate")}
                      </button>
                    </div>
                  </td>
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
            <Modal.Field label={t("name")} required>
              <input
                className="input"
                placeholder="Court 1"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </Modal.Field>
            <Modal.Grid>
              {/* Sport selector */}
              <Modal.Field label="Sport">
                <select
                  className="input"
                  value={form.sport}
                  onChange={(e) => handleSportChange(e.target.value as Sport)}
                >
                  {(Object.keys(SPORT_LABEL) as Sport[]).map((s) => (
                    <option key={s} value={s}>
                      {SPORT_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Modal.Field>
              {/* Surface — filtered by sport */}
              <Modal.Field label={t("surface")}>
                <select
                  className="input"
                  value={form.surface}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      surface: e.target.value as Surface,
                    }))
                  }
                >
                  {SURFACES_BY_SPORT[form.sport].map((s) => (
                    <option key={s} value={s}>
                      {SURFACE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Modal.Field>
            </Modal.Grid>
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
                <select
                  className="input"
                  value={form.is_indoor ? "indoor" : "outdoor"}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      is_indoor: e.target.value === "indoor",
                    }))
                  }
                >
                  <option value="outdoor">{t("outdoor")}</option>
                  <option value="indoor">{t("indoor")}</option>
                </select>
              </Modal.Field>
            </Modal.Grid>
            <Modal.Grid>
              <Modal.Field label={t("status")}>
                <select
                  className="input"
                  value={form.is_active ? "active" : "inactive"}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      is_active: e.target.value === "active",
                    }))
                  }
                >
                  <option value="active">{t("active")}</option>
                  <option value="inactive">{t("inactive")}</option>
                </select>
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
              disabled={!form.name || !form.price_per_hour || loading}
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
