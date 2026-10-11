"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { Member, MembershipPlan, MemberStatus } from "@/types/database";
import Modal from "@/components/ui/Modal";
import SubmitButton from "../ui/SubmitButton";

type MemberWithPlan = Member & { plan?: MembershipPlan | null };

type FormValues = {
  full_name: string;
  email: string;
  phone: string;
  plan_id: string;
  ends_at: string;
  notes: string;
  status: MemberStatus;
};

interface Props {
  members: MemberWithPlan[];
  plans: MembershipPlan[];
  clubId: string;
}

const STATUS_STYLE: Record<MemberStatus, string> = {
  active:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f3fbde] text-[#7aad12]",
  cancelled:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f4f4f4] text-[#6e7f65]",
  expired:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700",
};

export default function MembersClient({
  members: initial,
  plans,
  clubId,
}: Props) {
  const [members, setMembers] = useState(initial);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MemberWithPlan | null>(null);
  const [search, setSearch] = useState("");
  const supabase = createClient();
  const t = useTranslations("members");

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      plan_id: "",
      ends_at: "",
      notes: "",
      status: "active",
    },
  });

  const filtered = members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.phone?.includes(search),
  );

  const openAdd = () => {
    setEditing(null);
    reset({
      full_name: "",
      email: "",
      phone: "",
      plan_id: "",
      ends_at: "",
      notes: "",
      status: "active",
    });
    setShowModal(true);
  };

  const openEdit = (m: MemberWithPlan) => {
    setEditing(m);
    reset({
      full_name: m.full_name,
      email: m.email ?? "",
      phone: m.phone ?? "",
      plan_id: m.plan_id ?? "",
      ends_at: m.ends_at ? format(new Date(m.ends_at), "yyyy-MM-dd") : "",
      notes: m.notes ?? "",
      status: m.status,
    });
    setShowModal(true);
  };

  const onSubmit = async (values: FormValues) => {
    const payload = {
      full_name: values.full_name,
      email: values.email || null,
      phone: values.phone || null,
      plan_id: values.plan_id || null,
      ends_at: values.ends_at || null,
      notes: values.notes || null,
      status: values.status,
    };

    if (editing) {
      const res = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...payload }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError(data.field as "email" | "phone", {
          type: "manual",
          message: data.message,
        });
        return;
      }
      if (res.ok) {
        setMembers((prev) => prev.map((m) => (m.id === editing.id ? data : m)));
        setShowModal(false);
      }
    } else {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError(data.field as "email" | "phone", {
          type: "manual",
          message: data.message,
        });
        return;
      }
      if (res.ok) {
        setMembers((prev) => [data, ...prev]);
        setShowModal(false);
      }
    }
  };

  const handleCancel = async (id: string) => {
    const res = await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: "cancelled" as MemberStatus } : m,
        ),
      );
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-[#111c0a]">
            {t("title")}
          </h1>
          <p className="text-sm text-[#6e7f65] mt-1">
            {t("total", { count: members.length })}
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          {t("addMember")}
        </button>
      </div>

      <input
        type="text"
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input max-w-sm mb-6"
      />

      <div className="bg-white border border-[#e8ede4] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e8ede4] bg-[#f8f9f7]">
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("columns.name")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("columns.contact")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("columns.plan")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("columns.status")}
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#6e7f65]">
                {t("columns.expires")}
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {!filtered.length ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-12 text-[#6e7f65] text-sm"
                >
                  {search ? t("noResults") : t("noMembers")}
                </td>
              </tr>
            ) : (
              filtered.map((m, i) => (
                <tr
                  key={m.id}
                  className={`border-b border-[#e8ede4] hover:bg-[#f8f9f7] transition-colors ${i === filtered.length - 1 ? "border-0" : ""}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-[#111c0a]">
                      {m.full_name}
                    </div>
                    {m.notes && (
                      <div className="text-xs text-[#6e7f65] mt-0.5 truncate max-w-[160px]">
                        {m.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-[#3d4f35]">{m.email ?? "—"}</div>
                    <div className="text-xs text-[#6e7f65]">
                      {m.phone ?? ""}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {m.plan ? (
                      <div>
                        <div className="text-[#3d4f35]">{m.plan.name}</div>
                        <div className="text-xs text-[#6e7f65]">
                          €{m.plan.price} / {m.plan.billing_period}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[#6e7f65]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={STATUS_STYLE[m.status]}>
                      {t(`status.${m.status}`)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#3d4f35]">
                    {m.ends_at
                      ? format(new Date(m.ends_at), "d MMM yyyy")
                      : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => openEdit(m)}
                        className="text-xs text-[#7aad12] hover:text-[#3a7020] transition-colors font-medium"
                      >
                        {t("actions.edit")}
                      </button>
                      {m.status === "active" && (
                        <button
                          onClick={() => handleCancel(m.id)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          {t("actions.cancel")}
                        </button>
                      )}
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
            {editing ? t("modal.editTitle") : t("modal.addTitle")}
          </Modal.Header>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Modal.Body>
              <Modal.Field label={t("modal.fullName")} required>
                <input
                  className="input"
                  placeholder={t("modal.fullNamePlaceholder")}
                  {...register("full_name", {
                    required: t("modal.fullNameRequired"),
                  })}
                />
                {errors.full_name && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.full_name.message}
                  </p>
                )}
              </Modal.Field>
              <Modal.Grid>
                <Modal.Field label={t("modal.email")}>
                  <input
                    className="input"
                    type="email"
                    placeholder={t("modal.emailPlaceholder")}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </Modal.Field>
                <Modal.Field label={t("modal.phone")}>
                  <input
                    className="input"
                    placeholder={t("modal.phonePlaceholder")}
                    {...register("phone")}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.phone.message}
                    </p>
                  )}
                </Modal.Field>
              </Modal.Grid>
              <Modal.Grid>
                <Modal.Field label={t("modal.plan")}>
                  <select className="input" {...register("plan_id")}>
                    <option value="">{t("modal.noPlan")}</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — €{p.price}
                      </option>
                    ))}
                  </select>
                </Modal.Field>
                <Modal.Field label={t("modal.expires")}>
                  <input
                    className="input"
                    type="date"
                    {...register("ends_at")}
                  />
                </Modal.Field>
              </Modal.Grid>
              {editing && (
                <Modal.Field label={t("modal.status")}>
                  <select className="input" {...register("status")}>
                    <option value="active">{t("status.active")}</option>
                    <option value="cancelled">{t("status.cancelled")}</option>
                    <option value="expired">{t("status.expired")}</option>
                  </select>
                </Modal.Field>
              )}
              <Modal.Field label={t("modal.notes")}>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder={t("modal.notesPlaceholder")}
                  {...register("notes")}
                />
              </Modal.Field>
            </Modal.Body>
            <Modal.Footer>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary flex-1"
              >
                {t("modal.cancelBtn")}
              </button>
              <SubmitButton
                label={editing ? t("modal.saveBtn") : t("modal.addBtn")}
                loadingLabel={t("modal.saving")}
                className="flex-1"
              />
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal>
    </div>
  );
}
