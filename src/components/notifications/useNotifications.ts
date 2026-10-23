"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationRow } from "@/lib/notifications";

const COLUMNS = "id, kind, data, link, read_at, created_at";

/**
 * The signed-in person's notifications, kept live: new ones arrive without
 * reloading (Supabase Realtime), and the unread count follows.
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
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [limit, setLimit] = useState(size);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [supabase] = useState(() => createClient());
  const kindsKey = kinds?.join(",") ?? "";

  // Reads the list and the unread count; the caller puts them on screen.
  const fetchAll = useCallback(async () => {
    let query = supabase
      .from("notifications")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (unreadOnly) query = query.is("read_at", null);
    if (kindsKey) query = query.in("kind", kindsKey.split(","));
    const [{ data }, { count }] = await Promise.all([
      query,
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    ]);
    return { rows: (data ?? []) as NotificationRow[], count: count ?? 0 };
  }, [supabase, limit, unreadOnly, kindsKey]);

  const apply = useCallback(
    ({ rows, count }: { rows: NotificationRow[]; count: number }) => {
      setHasMore(rows.length > limit);
      setItems(rows.slice(0, limit));
      setUnread(count);
      setLoaded(true);
    },
    [limit],
  );

  const load = useCallback(() => {
    fetchAll().then(apply);
  }, [fetchAll, apply]);

  useEffect(() => {
    let live = true;
    fetchAll().then((result) => live && apply(result));
    return () => {
      live = false;
    };
  }, [fetchAll, apply]);

  // New notifications as they happen; also when one is marked read in
  // another tab. Coming back to the tab refreshes too, in case the
  // connection slept.
  useEffect(() => {
    const channel = supabase
      // The bell and the page each listen, so each gets its own channel name.
      .channel(`notifications:${userId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  const markRead = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n)));
      setUnread((u) => Math.max(0, u - 1));
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("id", id)
        .is("read_at", null);
      // The list changed before saving; if saving failed, show the real state again.
      if (error) {
        console.error("[notifications] mark read", error);
        load();
      }
    },
    [supabase, load],
  );

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => (unreadOnly ? [] : prev.map((n) => (n.read_at ? n : { ...n, read_at: now }))));
    setUnread(0);
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) {
      console.error("[notifications] mark all read", error);
      load();
    }
  }, [supabase, userId, unreadOnly, load]);

  return {
    items,
    unread,
    loaded,
    hasMore,
    showMore: () => setLimit((l) => l + size),
    markRead,
    markAllRead,
  };
}
