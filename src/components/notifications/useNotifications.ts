"use client";

import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { NotificationRow } from "@/lib/notifications";

const COLUMNS = "id, kind, data, link, read_at, created_at";

// Query keys. Everything for one person starts with ["notifications", userId],
// so one invalidate refreshes the bell, the page and the unread count together.
const allKey = (userId: string) => ["notifications", userId] as const;
const countKey = (userId: string) => ["notifications", userId, "unread"] as const;
const listKey = (userId: string, limit: number, unreadOnly: boolean, kinds: string) =>
  ["notifications", userId, "list", { limit, unreadOnly, kinds }] as const;

type List = { rows: NotificationRow[]; hasMore: boolean };

// One Realtime connection per person, however many lists are on screen (the
// bell and the notifications page both show one).
const live = new Map<string, { count: number; stop: () => void }>();

function listen(userId: string, client: QueryClient) {
  const current = live.get(userId);
  if (current) {
    current.count++;
  } else {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => client.invalidateQueries({ queryKey: allKey(userId) }),
      )
      .subscribe();
    live.set(userId, { count: 1, stop: () => supabase.removeChannel(channel) });
  }
  return () => {
    const entry = live.get(userId);
    if (!entry) return;
    if (--entry.count === 0) {
      entry.stop();
      live.delete(userId);
    }
  };
}

/**
 * The signed-in person's notifications, kept live: new ones arrive without
 * reloading (Supabase Realtime), and the unread count follows. Coming back to
 * the tab refreshes too, in case the connection slept (TanStack Query).
 *
 * `kinds` limits the list to some kinds (a filter); `unreadOnly` to unread.
 */
export function useNotifications({
  userId,
  size,
  unreadOnly = false,
  kinds = null,
}: {
  userId: string;
  size: number;
  unreadOnly?: boolean;
  kinds?: string[] | null;
}) {
  const client = useQueryClient();
  const [limit, setLimit] = useState(size);
  const kindsKey = kinds?.join(",") ?? "";

  useEffect(() => listen(userId, client), [userId, client]);

  const list = useQuery({
    queryKey: listKey(userId, limit, unreadOnly, kindsKey),
    queryFn: async (): Promise<List> => {
      let query = createClient()
        .from("notifications")
        .select(COLUMNS)
        .order("created_at", { ascending: false })
        .limit(limit + 1);
      if (unreadOnly) query = query.is("read_at", null);
      if (kindsKey) query = query.in("kind", kindsKey.split(","));
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as NotificationRow[];
      return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
    },
    // "Show more" and switching filters keep the old list on screen until the new one is in.
    placeholderData: keepPreviousData,
  });

  // Shared by the bell and the page: loaded once.
  const unread = useQuery({
    queryKey: countKey(userId),
    queryFn: async () => {
      const { count, error } = await createClient()
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  /**
   * Shows the change at once in every list and the count, saves it, and puts
   * the real state back if saving failed.
   */
  const markOptimistic = (ids: "all" | string) => {
    const now = new Date().toISOString();
    const hit = (n: NotificationRow) => !n.read_at && (ids === "all" || n.id === ids);
    // A load already on its way would bring the old state back.
    client.cancelQueries({ queryKey: allKey(userId) });
    for (const [key, old] of client.getQueriesData<List>({ queryKey: [...allKey(userId), "list"] })) {
      if (!old) continue;
      const onlyUnread = (key[3] as { unreadOnly?: boolean } | undefined)?.unreadOnly;
      client.setQueryData<List>(key, {
        ...old,
        rows: old.rows.flatMap((n) =>
          // "Mark all read" empties an unread-only list.
          !hit(n) ? [n] : onlyUnread && ids === "all" ? [] : [{ ...n, read_at: now }],
        ),
      });
    }
    client.setQueryData<number>(countKey(userId), (c) => (ids === "all" ? 0 : Math.max(0, (c ?? 0) - 1)));
    return now;
  };

  const readOne = useMutation({
    mutationFn: async ({ id, now }: { id: string; now: string }) => {
      const { error } = await createClient()
        .from("notifications")
        .update({ read_at: now })
        .eq("id", id)
        .is("read_at", null);
      if (error) throw error;
    },
    onError: (e) => console.error("[notifications] mark read", e),
    onSettled: () => client.invalidateQueries({ queryKey: allKey(userId) }),
  });

  const readAll = useMutation({
    mutationFn: async (now: string) => {
      const { error } = await createClient()
        .from("notifications")
        .update({ read_at: now })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
    },
    onError: (e) => console.error("[notifications] mark all read", e),
    onSettled: () => client.invalidateQueries({ queryKey: allKey(userId) }),
  });

  return {
    items: list.data?.rows ?? [],
    unread: unread.data ?? 0,
    loaded: list.isSuccess || list.isError,
    hasMore: list.data?.hasMore ?? false,
    showMore: () => setLimit((l) => l + size),
    markRead: (id: string) => {
      const now = markOptimistic(id);
      readOne.mutate({ id, now });
    },
    markAllRead: () => {
      const now = markOptimistic("all");
      readAll.mutate(now);
    },
  };
}
