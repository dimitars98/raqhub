import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReadOnlyProvider } from "@/components/admin/ReadOnly";
import GroupClient from "@/components/groups/GroupClient";
import { loadGroupDetail } from "@/lib/groupDetail";
import { monthOf } from "@/lib/groups";

// The group page for its coach: the list, the register and fees.
export default async function CoachGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const detail = await loadGroupDetail(supabase, id);
  if (!detail || detail.coachProfileId !== user.id) notFound();
  // After the club's free trial, its coach can look but not change anything.
  const { data: locked } = await supabase.rpc("club_locked", { p_club: detail.group.club_id });
  return (
    <ReadOnlyProvider value={!!locked}>
    <GroupClient
      mode="coach"
      group={detail.group}
      players={detail.players}
      sessions={detail.sessions}
      attendance={detail.attendance}
      fees={detail.fees}
      courts={[]}
      month={monthOf()}
      signupUrl={null}
    />
    </ReadOnlyProvider>
  );
}
