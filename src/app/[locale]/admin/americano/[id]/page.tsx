import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { requestOrigin } from "@/lib/requestOrigin";
import SocialClient from "@/components/admin/SocialClient";
import type { ClubCourt } from "@/components/americano/SocialForm";
import type { SocialView } from "@/lib/americano";

export default async function AdminSocialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ held?: string }>;
}) {
  const [{ id }, { held }, locale, origin] = await Promise.all([params, searchParams, getLocale(), requestOrigin()]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { club } = await getMyClub<{ id: string }>(supabase, user.id, "id");
  if (!club) redirect("/admin/setup");

  const [{ data }, { data: courts }] = await Promise.all([
    supabase.rpc("social_view", { p_event: id }),
    supabase.from("courts").select("id, name, sport").eq("club_id", club.id).eq("is_active", true).order("name"),
  ]);
  const view = data as unknown as SocialView | null;
  if (!view || view.event.club_id !== club.id) notFound();

  return (
    <SocialClient
      view={view}
      courts={(courts ?? []) as ClubCourt[]}
      publicUrl={`${origin}/${locale}/americano/${id}`}
      heldError={held ?? null}
    />
  );
}
