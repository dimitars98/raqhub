"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

export default function SignOutButton() {
  const supabase = createClient();
  const t = useTranslations("profilePage");
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-2 text-sm text-red-400 hover:text-red-600 transition-colors"
    >
      <LogOut size={14} />
      {t("signOut")}
    </button>
  );
}
