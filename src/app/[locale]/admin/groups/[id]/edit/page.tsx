import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import GroupForm from "@/components/groups/GroupForm";
import { groupFormOptions } from "@/lib/groupForm";
import { clubDay } from "@/lib/groups";
import type { Group } from "@/types/database";

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { club } = await getMyClub<{ id: string }>(supabase, user.id, "id");
  if (!club) redirect("/admin/setup");

  const { data: group } = await supabase.from("groups").select("*").eq("id", id).eq("club_id", club.id).maybeSingle();
  if (!group) notFound();

  const options = await groupFormOptions(supabase, club.id);
  return <GroupForm group={group as unknown as Group} {...options} today={clubDay(new Date())} />;
}
