"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import type { MembershipPlan, BillingPeriod } from "@/types/database";
import Modal from "@/components/ui/Modal";
import { useTranslations } from "next-intl";
import { BILLING_PERIODS } from "@/lib/labels";
import { useLabels } from "@/hooks/useLabels";
import { useReadOnly } from "@/components/admin/ReadOnly";
import SelectField from "@/components/ui/SelectField";


type FormValues = {
  name: string;
  description: string;
  price: number;
  billing_period: BillingPeriod;
  discount_pct: number;
};

export default function PlansClient({
  plans: initial,
  clubId,
}: {
  plans: MembershipPlan[];
  clubId: string;
}) {
  const t = useTranslations("plansAdmin");
  const { readOnly, hint } = useReadOnly();
  const labels = useLabels();
  const [plans, setPlans] = useState(initial);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const supabase = createClient();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      billing_period: "monthly",
      discount_pct: 0,
    },
  });

  const openAdd = () => {
    setEditing(null);
    reset({
      name: "",
      description: "",
      price: 0,
      billing_period: "monthly",
      discount_pct: 0,
    });
    setShowModal(true);
  };

  const openEdit = (p: MembershipPlan) => {
    setEditing(p);
    reset({
      name: p.name,
      description: p.description ?? "",
      price: p.price,
      billing_period: p.billing_period,
      discount_pct: p.discount_pct,
    });
    setShowModal(true);
  };

  const onSubmit = async (values: FormValues) => {
    const payload = {
      ...values,
      description: values.description || null,
      club_id: clubId,
    } as unknown as never;

    const query = editing
      ? supabase.from("membership_plans").update(payload).eq("id", editing.id)
      : supabase.from("membership_plans").insert(payload);
    const { data, error } = (await query.select().single()) as {
      data: MembershipPlan | null;
      error: unknown;
    };
    if (error || !data) {
      console.error("[plans] save", error);
      setError("root", { type: "manual", message: readOnly ? hint : t("saveFailed") });
      return;
    }
    if (editing) setPlans((prev) => prev.map((p) => (p.id === editing.id ? data : p)));
    else setPlans((prev) => [...prev, data]);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(t("confirmDelete"))
    )
      return;
    setDeleting(id);
    setNotice(null);
    const { error } = await supabase.from("membership_plans").delete().eq("id", id);
    setDeleting(null);
    if (error) {
      console.error("[plans] delete", error);
      setNotice(readOnly ? hint ?? null : t("deleteFailed"));
      return;
    }
    setPlans((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-ink-900">
            {t("title")}
          </h1>
          <p className="text-sm text-brand-600 mt-1">{t("count", { n: plans.length })}</p>
        </div>
        <button onClick={openAdd} disabled={readOnly} title={hint} className="btn-primary">
          {t("addPlan")}
        </button>
      </div>

      {notice && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {notice}
        </p>
      )}

      {!plans.length ? (
        <div className="card p-12 text-center">
          <p className="text-sm text-ink-400 mb-4">
            {t("empty")}
          </p>
          <button onClick={openAdd} disabled={readOnly} title={hint} className="btn-primary">
            {t("addFirst")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-ink-900">
                    {p.name}
                  </div>
                  <div className="text-xs text-ink-400 mt-0.5">
                    {labels.billingPeriod(p.billing_period)}
                  </div>
                </div>
                <div className="text-lg font-medium text-ink-900">
                  €{p.price}
                </div>
              </div>
              {p.description && (
                <p className="text-xs text-ink-600 mb-3">{p.description}</p>
              )}
              {p.discount_pct > 0 && (
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 mb-3">
                  {t("discount", { pct: p.discount_pct })}
                </div>
              )}
              <div className="flex gap-3 mt-4 pt-4 border-t border-ink-100">
                <button title={hint} disabled={readOnly}
                  onClick={() => openEdit(p)}
                  className="text-xs text-ink-400 hover:text-ink-900 transition-colors"
                >
                  {t("edit")}
                </button>
                <button title={hint}
                  onClick={() => handleDelete(p.id)}
                  disabled={readOnly || deleting === p.id}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                >
                  {deleting === p.id ? t("deleting") : t("delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <Modal.Content>
          <Modal.Header>{editing ? t("editPlan") : t("addPlan")}</Modal.Header>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Modal.Body>
              <Modal.Field label={t("name")} required>
                <input
                  className="input"
                  placeholder={t("namePlaceholder")}
                  {...register("name", { required: t("nameRequired") })}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.name.message}
                  </p>
                )}
              </Modal.Field>
              <Modal.Grid>
                <Modal.Field label={t("price")} required>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="30"
                    {...register("price", {
                      required: true,
                      valueAsNumber: true,
                      min: 0,
                    })}
                  />
                </Modal.Field>
                <Modal.Field label={t("billingPeriod")}>
                  <Controller
                    name="billing_period"
                    control={control}
                    render={({ field }) => (
                      <SelectField
                        ariaLabel={t("billingPeriod")}
                        value={field.value}
                        onChange={field.onChange}
                        options={BILLING_PERIODS.map((b) => ({ value: b, label: labels.billingPeriod(b) }))}
                      />
                    )}
                  />
                </Modal.Field>
              </Modal.Grid>
              <Modal.Field label={t("discountField")}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  {...register("discount_pct", {
                    valueAsNumber: true,
                    min: 0,
                    max: 100,
                  })}
                />
              </Modal.Field>
              <Modal.Field label={t("description")}>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder={t("descriptionPlaceholder")}
                  {...register("description")}
                />
              </Modal.Field>
              {errors.root && (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {errors.root.message}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary flex-1"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {isSubmitting
                  ? t("saving")
                  : editing
                    ? t("saveChanges")
                    : t("addPlan")}
              </button>
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal>
    </div>
  );
}
