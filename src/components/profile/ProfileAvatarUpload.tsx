"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

export default function ProfileAvatarUpload({
  userId,
  avatarUrl,
  initials,
}: {
  userId: string;
  avatarUrl: string | null;
  initials: string;
}) {
  const tc = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    startTransition(async () => {
      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        console.error(uploadError);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);

      await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl } as unknown as never)
        .eq("id", userId);

      router.refresh();
    });
  };

  return (
    <div className="relative flex-shrink-0">
      {preview ? (
        <img
          src={preview}
          alt={tc("avatar")}
          className="w-14 h-14 rounded-full object-cover"
        />
      ) : (
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-base font-medium text-brand-700">
          {initials}
        </div>
      )}

      <button
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center border-2 border-white hover:bg-brand-700 transition-colors disabled:opacity-50"
        aria-label={tc("changeAvatar")}
      >
        <Camera size={11} color="white" />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
