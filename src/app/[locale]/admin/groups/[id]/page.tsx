import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import GroupClient from "@/components/groups/GroupClient";
import { loadGroupDetail } from "@/lib/groupDetail";
import { monthOf } from "@/lib/groups";
import { appUrl } from "@/lib/email/bookings";

export default async function AdminGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; removed?: string; skipped?: string }>;
}) {
  const [{ id }, q, locale] = await Promise.all([params, searchParams, getLocale()]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { club } = await getMyClub<{ id: string }>(supabase, user.id, "id");
  if (!club) redirect("/admin/setup");

  const detail = await loadGroupDetail(supabase, id);
  if (!detail || detail.group.club_id !== club.id) notFound();

  const { data: courts } = await supabase
    .from("courts")
    .select("id, name")
    .eq("club_id", club.id)
    .eq("is_active", true)
    .order("name");

  // "Saved: 47 sessions added, 2 days skipped" after the form.
  const t = await getTranslations("groups.detail");
  const parts = [
    q.created ? t("savedCreated", { n: Number(q.created) }) : null,
    q.removed ? t("savedRemoved", { n: Number(q.removed) }) : null,
    q.skipped ? t("savedSkipped", { n: Number(q.skipped) }) : null,
  ].filter(Boolean);
  const notice = q.created || q.removed || q.skipped ? `${t("saved")} ${parts.join(", ")}.` : null;

  return (
    <GroupClient
      mode="admin"
      group={detail.group}
      players={detail.players}
      sessions={detail.sessions}
      attendance={detail.attendance}
      fees={detail.fees}
      courts={courts ?? []}
      month={monthOf()}
      signupUrl={detail.club ? `${appUrl()}/${locale}/clubs/${detail.club.slug}#groups` : null}
      notice={notice}
    />
  );
}
