import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/email/bookings";
import TournamentClient from "@/components/admin/TournamentClient";
import type { Tournament, TournamentEntry, TournamentMatch } from "@/types/database";

export default async function AdminTournamentPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only a tournament of the signed-in owner's club.
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*, club:clubs!inner(owner_id)")
    .eq("id", id)
    .eq("club.owner_id", user.id)
    .maybeSingle();
  if (!tournament) notFound();

  const [{ data: entries }, { data: matches }] = await Promise.all([
    supabase.from("tournament_entries").select("*").eq("tournament_id", id).order("created_at"),
    supabase.from("tournament_matches").select("*").eq("tournament_id", id),
  ]);

  return (
    <TournamentClient
      tournament={tournament as unknown as Tournament}
      entries={(entries ?? []) as TournamentEntry[]}
      matches={(matches ?? []) as TournamentMatch[]}
      publicUrl={`${appUrl()}/${locale}/tournaments/${id}`}
    />
  );
}
