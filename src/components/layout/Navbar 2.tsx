"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { scrollToTop } from "@/helpers/scrollToTop";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  return (
    <nav className="border-b border-orange-100 bg-[#fff8f2] sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          onClick={() => scrollToTop()}
          className="text-[15px] font-medium text-orange-900 tracking-tight cursor-pointer"
        >
          ServeTime
        </Link>
        <div>
          {user ? (
            <Link href="/admin/members" className="btn-primary text-sm">
              Go to dashboard →
            </Link>
          ) : (
            <Link href="/login" className="btn-primary text-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
