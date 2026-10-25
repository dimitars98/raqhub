import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MatchClient from "@/components/matches/MatchClient";
import { loadMyLevels } from "@/lib/myLevels";
import type { MatchDetail } from "@/lib/openMatches";

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, levels] = await Promise.all([
    supabase.rpc("open_match_detail", { p_match: id }),
    loadMyLevels(supabase, user.id),
  ]);
  const match = data as unknown as MatchDetail | null;
  if (!match) notFound();

  const myLevel = levels.find((l) => l.sport === match.sport)?.level ?? null;
  return <MatchClient match={match} myLevel={myLevel} justOpened={isNew === "1"} />;
}
