"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";
import type { Coach, Level } from "@/types/database";
import Modal from "@/components/ui/Modal";
import { LEVELS } from "@/lib/labels";
import { useLabels } from "@/hooks/useLabels";
import { useReadOnly } from "@/components/admin/ReadOnly";

const EMPTY_FORM = {
  email: "",
  bio: "",
  specializations: "",
  price_per_hour: "",
  levels: [] as Level[],
  is_active: true,
};

interface Props {
  coaches: Coach[];
  clubId: string;
}

type FoundProfile = { id: string; full_name: string | null };

const COACH_SELECT =
  "*, profile:profiles(id, full_name, avatar_url, phone, role, stripe_customer_id, created_at, updated_at)";

export default function CoachesClient({ coaches: initial, clubId }: Props) {
  const [coaches, setCoaches] = useState(initial);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Coach | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const supabase = createClient();
  const t = useTranslations("adminCoaches");
  const { readOnly, hint } = useReadOnly();

  const labels = useLabels();

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (c: Coach) => {
    setEditing(c);
    setForm({
      email: "",
      bio: c.bio ?? "",
      specializations: c.specializations.join(", "),
      price_per_hour: String(c.price_per_hour),
      levels: c.levels,
      is_active: c.is_active,
    });
    setError(null);
    setShowModal(true);
  };

  const toggleLevel = (level: Level) => {
    setForm((f) => ({
      ...f,
      levels: f.levels.includes(level)
        ? f.levels.filter((l) => l !== level)
        : [...f.levels, level],
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    if (editing) {
      const payload = {
        bio: form.bio || null,
        specializations: form.specializations
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        levels: form.levels,
        price_per_hour: parseFloat(form.price_per_hour),
        is_active: form.is_active,
      };

      const { data, error: updateError } = await supabase
        .from("coaches")
        .update(payload)
        .eq("id", editing.id)
        .select(COACH_SELECT)
        .single();

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setCoaches((prev) =>
          prev.map((c) =>
            c.id === editing.id ? (data as unknown as Coach) : c,
          ),
        );
      }
    } else {
      // Look the account up by email. The database function only answers
      // club owners and returns at most one row.
      const lookup = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: { lookup_email: string },
      ) => PromiseLike<{
        data: FoundProfile[] | null;
        error: { message: string } | null;
      }>;

      const { data: found, error: lookupError } = await lookup(
        "find_profile_by_email",
        { lookup_email: form.email.trim() },
      );

      if (lookupError) {
        setError(lookupError.message);
        setLoading(false);
        return;
      }

      const profileId = found?.[0]?.id;

      if (!profileId) {
        setError(t("profileNotFound"));
        setLoading(false);
        return;
      }

      if (coaches.some((c) => c.profile_id === profileId)) {
        setError(t("alreadyCoach"));
        setLoading(false);
        return;
      }

      const { data, error: insertError } = await supabase
        .from("coaches")
        .insert({
          profile_id: profileId,
          club_id: clubId,
          bio: form.bio || null,
          specializations: form.specializations
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          levels: form.levels,
          price_per_hour: parseFloat(form.price_per_hour),
          is_active: form.is_active,
        })
        .select(COACH_SELECT)
        .single();

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      if (data) setCoaches((prev) => [data as unknown as Coach, ...prev]);
    }

    setLoading(false);
    setShowModal(false);
  };

  const handleToggle = async (coach: Coach) => {
    const next = !coach.is_active;
    setPageError(null);

    const { error: toggleError } = await supabase
      .from("coaches")
      .update({ is_active: next })
      .eq("id", coach.id);

    if (toggleError) {
      setPageError(toggleError.message);
      return;
    }

    setCoaches((prev) =>
      prev.map((c) => (c.id === coach.id ? { ...c, is_active: next } : c)),
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-ink-900">{t("title")}</h1>
          <p className="text-sm text-brand-600 mt-1">
            {coaches.length} {t("total")}
          </p>
        </div>
        <button
          title={hint}
          disabled={readOnly}
          onClick={openAdd}
          className="btn-primary"
        >
          {t("addCoach")}
        </button>
      </div>

      {pageError && (
        <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          {pageError}
        </div>
      )}

      <div className="bg-white border border-ink-100 rounded-2xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-ink-400">
                {t("name")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-ink-400">
                {t("specializations")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-ink-400">
                {t("levels")}
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
            {!coaches.length ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-12 text-ink-400 text-sm"
                >
                  {t("noCoaches")}
                </td>
              </tr>
            ) : (
              coaches.map((c, i) => (
                <tr
                  key={c.id}
                  className={`border-b border-ink-100 hover:bg-ink-50 transition-colors ${
                    i === coaches.length - 1 ? "border-0" : ""
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-ink-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(c.profile?.full_name ?? "?")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-ink-900">
                          {c.profile?.full_name ?? t("unknown")}
                        </div>
                        {c.bio && (
                          <div className="text-xs text-ink-400 mt-0.5 truncate max-w-[160px]">
                            {c.bio}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-ink-600">
                    {c.specializations.length ? (
                      c.specializations.join(", ")
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {c.levels.map((l) => (
                        <span
                          key={l}
                          className="badge-brand text-[10px] px-2 py-0.5"
                        >
                          {labels.level(l)}
                        </span>
                      ))}
                    </div>
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
                        title={hint}
                        disabled={readOnly}
                        onClick={() => openEdit(c)}
                        className="text-xs text-ink-400 hover:text-ink-900 transition-colors"
                      >
                        {t("edit")}
                      </button>
                      <button
                        title={hint}
                        disabled={readOnly}
                        onClick={() => handleToggle(c)}
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

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <Modal.Content>
          <Modal.Header>
            {editing ? t("editCoach") : t("addCoach")}
          </Modal.Header>
          <Modal.Body>
            {error && (
              <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {!editing && (
              <Modal.Field label={t("coachEmail")} required>
                <input
                  className="input"
                  type="email"
                  autoComplete="off"
                  placeholder={t("coachEmailPlaceholder")}
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
                <p className="text-xs text-ink-400 mt-1.5">
                  {t("coachEmailHint")}
                </p>
              </Modal.Field>
            )}

            <Modal.Grid>
              <Modal.Field label={t("pricePerHour")}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="25"
                  value={form.price_per_hour}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price_per_hour: e.target.value }))
                  }
                />
              </Modal.Field>
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

            <Modal.Field label={t("specializations")}>
              <input
                className="input"
                placeholder={t("specializationsPlaceholder")}
                value={form.specializations}
                onChange={(e) =>
                  setForm((f) => ({ ...f, specializations: e.target.value }))
                }
              />
            </Modal.Field>

            <Modal.Field label={t("levels")}>
              <div className="flex flex-wrap gap-2 pt-1">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLevel(l)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      form.levels.includes(l)
                        ? "bg-brand-100 border-brand-400 text-brand-800 font-medium"
                        : "bg-white border-ink-200 text-ink-600 hover:border-brand-400"
                    }`}
                  >
                    {labels.level(l)}
                  </button>
                ))}
              </div>
            </Modal.Field>

            <Modal.Field label={t("bio")}>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder={t("bioPlaceholder")}
                value={form.bio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bio: e.target.value }))
                }
              />
            </Modal.Field>
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
              disabled={
                !form.price_per_hour ||
                (!editing && !form.email.trim()) ||
                loading
              }
              className="btn-primary flex-1 disabled:opacity-40"
            >
              {loading
                ? t("saving")
                : editing
                  ? t("saveChanges")
                  : t("addCoach")}
            </button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </div>
  );
}
