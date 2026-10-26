"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MyMembership } from "@/types/database";

// What the booking screens load in the browser, shared through TanStack
// Query (src/components/providers/QueryProvider.tsx): going back to a day
// you already looked at is instant, and coming back to the tab refreshes it.

export type Busy = { starts_at: string; ends_at: string };

const busyKey = (courtId: string, day: string) => ["busy", courtId, day] as const;

async function loadBusy(courtId: string, day: string): Promise<Busy[]> {
  const { data, error } = await createClient().rpc("get_busy_slots", { p_court_id: courtId, p_day: day });
  if (error) {
    console.error("[get_busy_slots]", error);
    throw error;
  }
  return (data ?? []) as Busy[];
}

/**
 * Taken (and closed) times of one court on one day (yyyy-MM-dd).
 * `ready` is false while loading. If loading fails the list is empty, so
 * every time stays open: the database still refuses a clash.
 */
export function useBusySlots(courtId: string | null | undefined, day: string) {
  const q = useQuery({
    queryKey: busyKey(courtId ?? "", day),
    queryFn: () => loadBusy(courtId!, day),
    enabled: !!courtId,
  });
  return { slots: q.data ?? [], ready: q.isSuccess || q.isError };
}

/** The same for several courts at once: { [courtId]: Busy[] }. */
export function useBusySlotsForCourts(courtIds: string[], day: string) {
  return useQueries({
    queries: courtIds.map((id) => ({ queryKey: busyKey(id, day), queryFn: () => loadBusy(id, day) })),
    combine: (results) => ({
      byCourt: Object.fromEntries(courtIds.map((id, i) => [id, results[i]?.data ?? []])) as Record<string, Busy[]>,
      ready: results.every((r) => r.isSuccess || r.isError),
    }),
  });
}

/** A coach's taken times on one day, plus times when every court is taken. */
export function useCoachBusySlots(coachId: string, day: string) {
  const q = useQuery({
    queryKey: ["coachBusy", coachId, day],
    queryFn: async () => {
      const { data, error } = await createClient().rpc("get_coach_busy_slots", { p_coach_id: coachId, p_day: day });
      if (error) {
        console.error("[get_coach_busy_slots]", error);
        throw error;
      }
      return (data ?? []) as Busy[];
    },
  });
  return { slots: q.data ?? [], ready: q.isSuccess || q.isError };
}

/** Loads the free times again, e.g. after someone else took the one you picked. */
export function useRefreshBusy() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: ["busy"] });
    client.invalidateQueries({ queryKey: ["coachBusy"] });
  };
}

/**
 * The member discount (%) the signed-in player gets at this club, or 0.
 * Loaded once and reused for five minutes; the database applies the real
 * discount when booking either way.
 */
export function useMemberDiscount(clubId: string | null | undefined) {
  const q = useQuery({
    queryKey: ["myMemberships"],
    queryFn: async () => {
      const { data, error } = await createClient().rpc("my_memberships");
      if (error) throw error;
      return (data ?? []) as unknown as MyMembership[];
    },
    staleTime: 5 * 60_000,
    enabled: !!clubId,
  });
  const membership = (q.data ?? []).find((m) => m.club_id === clubId && m.status === "active");
  return membership?.plan?.discount_pct ?? 0;
}
