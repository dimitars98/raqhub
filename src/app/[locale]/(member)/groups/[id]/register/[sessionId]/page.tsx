import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  return <RegisterClient backHref={`/groups/${id}`} {...data} />;
}
