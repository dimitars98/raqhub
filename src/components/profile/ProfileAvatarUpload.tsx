"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

const MAX_BYTES = 5_000_000;

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
  const tp = useTranslations("profilePage");
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still triggers
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) return setError(tp("photoType"));
    if (file.size > MAX_BYTES) return setError(tp("photoTooBig", { mb: MAX_BYTES / 1_000_000 }));

    // Local preview, put back if the upload fails
    const before = preview;
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    const failed = (e: unknown) => {
      console.error("[avatar]", e);
      setPreview(before);
      URL.revokeObjectURL(objectUrl);
      setError(tp("photoFailed"));
    };

    startTransition(async () => {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadError) return failed(uploadError);

        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        // Same address every time, so add a version or browsers keep the old photo.
        const { error: saveError } = await supabase
          .from("profiles")
          .update({ avatar_url: `${data.publicUrl}?v=${Date.now()}` } as unknown as never)
          .eq("id", userId);
        if (saveError) return failed(saveError);

        router.refresh();
      } catch (e) {
        failed(e);
      }
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

      {error && (
        <p role="alert" className="absolute left-0 top-full z-10 mt-2 w-60 text-xs leading-snug text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
