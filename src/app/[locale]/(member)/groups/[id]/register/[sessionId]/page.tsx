import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReadOnlyProvider } from "@/components/admin/ReadOnly";
import RegisterClient from "@/components/groups/RegisterClient";
import { loadRegister } from "@/lib/groupRegister";

// The coach's register, from their own (player) account.
export default async function CoachRegisterPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const data = await loadRegister(supabase, id, sessionId);
  if (!data) notFound();
  // After the club's free trial, its coach can look but not change anything.
  const { data: club } = await supabase.from("groups").select("club_id").eq("id", id).maybeSingle();
  const { data: locked } = club
    ? await supabase.rpc("club_locked", { p_club: club.club_id })
    : { data: false };
  return (
    <ReadOnlyProvider value={!!locked}>
      <RegisterClient backHref={`/groups/${id}`} {...data} />
    </ReadOnlyProvider>
  );
}
