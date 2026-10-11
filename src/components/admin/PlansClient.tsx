"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import type { MembershipPlan, BillingPeriod } from "@/types/database";
import Modal from "@/components/ui/Modal";

const BILLING_LABEL: Record<BillingPeriod, string> = {
  monthly: "Monthly",
  annual: "Annual",
  one_time: "One time",
};

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
  const [plans, setPlans] = useState(initial);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
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

    if (editing) {
      const { data } = (await supabase
        .from("membership_plans")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()) as { data: MembershipPlan | null };
      if (data)
        setPlans((prev) => prev.map((p) => (p.id === editing.id ? data : p)));
    } else {
      const { data } = (await supabase
        .from("membership_plans")
        .insert(payload)
        .select()
        .single()) as { data: MembershipPlan | null };
      if (data) setPlans((prev) => [...prev, data]);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm("Delete this plan? Members assigned to it will lose their plan.")
    )
      return;
    setDeleting(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("membership_plans") as any).delete().eq("id", id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-orange-900">
            Membership plans
          </h1>
          <p className="text-sm text-orange-500 mt-1">{plans.length} plans</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          Add plan
        </button>
      </div>

      {!plans.length ? (
        <div className="card p-12 text-center">
          <p className="text-sm text-orange-400 mb-4">
            No plans yet. Create one to assign to members.
          </p>
          <button onClick={openAdd} className="btn-primary">
            Add your first plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-orange-900">
                    {p.name}
                  </div>
                  <div className="text-xs text-orange-400 mt-0.5">
                    {BILLING_LABEL[p.billing_period]}
                  </div>
                </div>
                <div className="text-lg font-medium text-orange-900">
                  €{p.price}
                </div>
              </div>
              {p.description && (
                <p className="text-xs text-orange-600 mb-3">{p.description}</p>
              )}
              {p.discount_pct > 0 && (
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-3">
                  {p.discount_pct}% discount on bookings
                </div>
              )}
              <div className="flex gap-3 mt-4 pt-4 border-t border-orange-50">
                <button
                  onClick={() => openEdit(p)}
                  className="text-xs text-orange-600 hover:text-orange-900 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deleting === p.id}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                >
                  {deleting === p.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <Modal.Content>
          <Modal.Header>{editing ? "Edit plan" : "Add plan"}</Modal.Header>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Modal.Body>
              <Modal.Field label="Plan name" required>
                <input
                  className="input"
                  placeholder="Monthly membership"
                  {...register("name", { required: "Name is required" })}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.name.message}
                  </p>
                )}
              </Modal.Field>
              <Modal.Grid>
                <Modal.Field label="Price (€)" required>
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
                <Modal.Field label="Billing period">
                  <select className="input" {...register("billing_period")}>
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                    <option value="one_time">One time</option>
                  </select>
                </Modal.Field>
              </Modal.Grid>
              <Modal.Field label="Booking discount (%)">
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
              <Modal.Field label="Description">
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="What's included in this plan..."
                  {...register("description")}
                />
              </Modal.Field>
            </Modal.Body>
            <Modal.Footer>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {isSubmitting
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Add plan"}
              </button>
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal>
    </div>
  );
}
