import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RegisterClient from "@/components/groups/RegisterClient";
import { loadRegister } from "@/lib/groupRegister";

export default async function AdminRegisterPage({
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
  return <RegisterClient backHref={`/admin/groups/${id}`} {...data} />;
}
