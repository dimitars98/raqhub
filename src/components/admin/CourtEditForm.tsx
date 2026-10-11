"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Court, Surface } from "@/types/database";

const SURFACES = [
  { value: "clay", label: "Clay" },
  { value: "hard", label: "Hard" },
  { value: "grass", label: "Grass" },
  { value: "artificial_grass", label: "Artificial grass" },
  { value: "carpet", label: "Carpet" },
];

export default function CourtEditForm({ court }: { court: Court }) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    name: court.name,
    surface: court.surface,
    price_per_hour: court.price_per_hour,
    is_indoor: court.is_indoor,
    is_active: court.is_active,
    description: court.description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await (
      supabase.from("courts") as unknown as {
        update: (values: Partial<Court>) => {
          eq: (col: string, val: string) => Promise<void>;
        };
      }
    )
      .update({
        name: form.name,
        surface: form.surface,
        price_per_hour: form.price_per_hour,
        is_indoor: form.is_indoor,
        is_active: form.is_active,
        description: form.description || null,
      })
      .eq("id", court.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  };

  return (
    <div className="card p-6 space-y-5">
      <h2 className="text-sm font-medium text-orange-900">Court details</h2>

      <div>
        <label className="block text-xs text-orange-500 mb-1.5">Name</label>
        <input
          className="input w-full"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-orange-500 mb-1.5">
            Surface
          </label>
          <select
            className="input w-full"
            value={form.surface}
            onChange={(e) =>
              setForm((f) => ({ ...f, surface: e.target.value as Surface }))
            }
          >
            {SURFACES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-orange-500 mb-1.5">
            Price per hour (€)
          </label>
          <input
            type="number"
            className="input w-full"
            value={form.price_per_hour}
            onChange={(e) =>
              setForm((f) => ({ ...f, price_per_hour: Number(e.target.value) }))
            }
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-orange-500 mb-1.5">
          Description
        </label>
        <textarea
          className="input w-full resize-none"
          rows={3}
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_indoor}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_indoor: e.target.checked }))
            }
            className="rounded border-orange-200 text-orange-400"
          />
          <span className="text-sm text-orange-700">Indoor</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_active: e.target.checked }))
            }
            className="rounded border-orange-200 text-orange-400"
          />
          <span className="text-sm text-orange-700">Active</span>
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary text-sm"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
      </button>
    </div>
  );
}
