"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

type FormValues = {
  full_name: string;
  phone: string;
};

export default function ProfileEditForm({
  userId,
  defaultValues,
}: {
  userId: string;
  defaultValues: FormValues;
}) {
  const t = useTranslations("profilePage");
  const [form, setForm] = useState<FormValues>(defaultValues);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const handleSave = () => {
    setFailed(false);
    startTransition(async () => {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: form.full_name || null,
            phone: form.phone || null,
          } as unknown as never)
          .eq("id", userId);
        if (error) throw error;
      } catch (e) {
        console.error("[profile]", e);
        setFailed(true);
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-brand-600 mb-1.5">
          {t("fullName")}
        </label>
        <input
          className="input w-full"
          value={form.full_name}
          onChange={(e) =>
            setForm((f) => ({ ...f, full_name: e.target.value }))
          }
          placeholder={t("yourName")}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-brand-600 mb-1.5">
          {t("phone")}
        </label>
        <input
          className="input w-full"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="+389 70 000 000"
          type="tel"
        />
      </div>
      <div className="flex items-center justify-end gap-3 pt-1">
        {failed && (
          <span role="alert" className="text-xs text-red-600">
            {t("saveFailed")}
          </span>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-xs text-brand-600">
            <Check size={12} strokeWidth={2.5} />
            {t("saved")}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="btn-primary text-sm disabled:opacity-40"
        >
          {isPending ? t("saving") : t("saveChanges")}
        </button>
      </div>
    </div>
  );
}
