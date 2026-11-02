"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";

/**
 * Club admins and staff are signed out after a long time without using the
 * dashboard, so a reception computer left signed in overnight doesn't keep
 * the club's members and payments open. Players are never signed out.
 *
 * The time of the last activity is kept in localStorage, so it is shared by
 * every tab and survives closing the browser.
 */
const IDLE_LIMIT_MS = 12 * 60 * 60 * 1000;
const KEY = "raqhub.adminLastActive";
const CHECK_EVERY_MS = 5 * 60 * 1000;
/** Activity is written at most this often. */
const WRITE_EVERY_MS = 60 * 1000;

const read = () => {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
};
const write = (t: number) => {
  try {
    localStorage.setItem(KEY, String(t));
  } catch {
    // Private mode or storage off: the timeout just doesn't apply.
  }
};

export default function IdleSignOut({ lastSignInAt }: { lastSignInAt: string | null }) {
  const locale = useLocale();

  useEffect(() => {
    // A fresh sign-in counts as activity, so an old timestamp from before
    // signing in can't sign the person straight back out.
    const signedIn = lastSignInAt ? new Date(lastSignInAt).getTime() : 0;
    let lastWrite = 0;
    let leaving = false;

    const signOut = async () => {
      if (leaving) return;
      leaving = true;
      try {
        localStorage.removeItem(KEY);
      } catch {}
      await createClient().auth.signOut();
      const here = window.location.pathname + window.location.search;
      window.location.href = `/${locale}/login?reason=idle&redirectTo=${encodeURIComponent(here)}`;
    };

    /** Signs out if idle too long. True if it did. */
    const check = () => {
      const last = Math.max(read(), signedIn);
      if (last && Date.now() - last > IDLE_LIMIT_MS) {
        signOut();
        return true;
      }
      return false;
    };

    const active = () => {
      if (check()) return;
      const now = Date.now();
      if (now - lastWrite > WRITE_EVERY_MS) {
        lastWrite = now;
        write(now);
      }
    };

    // Coming back to the computer: check before anything else counts as activity.
    const onVisible = () => {
      if (document.visibilityState === "visible") active();
    };

    active();
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, active, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, CHECK_EVERY_MS);

    return () => {
      for (const e of events) window.removeEventListener(e, active);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [lastSignInAt, locale]);

  return null;
}
