// Turns a database error from the Americano functions into a message key
// under americano.errors (see 20261030_americano.sql).

export type SocialResult = { error?: string };

const KEY: [string, string][] = [
  ["social_already_reported", "alreadyReported"],
  ["social_already", "already"],
  ["social_closed", "closed"],
  ["social_full", "full"],
  ["social_level", "level"],
  ["social_name", "entryName"],
  ["social_score", "score"],
  ["social_round_done", "roundDone"],
  ["not_signed_in", "notSignedIn"],
  ["club_locked", "paused"],
];

export function socialError(error: { message?: string; code?: string } | null, where: string) {
  const message = error?.message ?? "";
  const hit = KEY.find(([k]) => message.includes(k));
  if (hit) return hit[1];
  if (error?.code === "23505") return "already";
  if (error?.code === "23P01" || message.includes("court_closed")) return "courtTaken";
  console.error(where, error);
  return "failed";
}
