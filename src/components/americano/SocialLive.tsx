"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import SocialBoard from "@/components/americano/SocialBoard";
import type { SocialMatch, SocialView } from "@/lib/americano";

/**
 * The public board of an evening. While it is being played it reloads every
 * 20 seconds, so a phone (or a TV at the club) keeps up with the scores.
 */
export default function SocialLive({ view }: { view: SocialView }) {
  const router = useRouter();
  const running = view.event.status === "running";

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(id);
  }, [running, router]);

  const mine = new Set(view.players.filter((p) => p.mine).map((p) => p.id));
  const lastRound = Math.max(0, ...view.matches.map((m) => m.round));
  // A player enters the score of their own game in the round being played.
  const canScore = (m: SocialMatch) =>
    running &&
    m.round === lastRound &&
    [m.a1, m.a2, m.b1, m.b2].some((id) => mine.has(id)) &&
    (m.score_a == null || m.reported_by_me);

  return <SocialBoard view={view} canScore={canScore} />;
}
