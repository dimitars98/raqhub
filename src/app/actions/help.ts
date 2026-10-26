"use server";

import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { sendEmail } from "@/lib/email/send";
import { SALES_EMAIL } from "@/lib/plans";

// "Report a problem" in the help panel: an email to you (ADMIN_EMAIL, or the
// support address) with who sent it, from which club and which page.

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function reportProblem(message: string, page: string): Promise<{ ok: boolean }> {
  const text = message.trim().slice(0, 2000);
  if (text.length < 5) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const [{ data: profile }, { club, isStaff }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    getMyClub<{ id: string; name: string }>(supabase, user.id, "id, name"),
  ]);

  const who = profile?.full_name || user.email || "Someone";
  const role = club ? (isStaff ? "staff" : "club owner") : profile?.role === "super_admin" ? "super admin" : "player";
  const where = page.slice(0, 300);
  const rows: [string, string][] = [
    ["From", `${who} <${user.email ?? "no email"}>`],
    ["Role", role],
    ["Club", club?.name ?? "–"],
    ["Page", where],
  ];

  const subject = `Problem report from ${who}${club ? ` (${club.name})` : ""}`;
  const plain = `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${text}`;
  const html = `<table style="font:14px sans-serif;border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#6e7f65">${k}</td><td>${escape(v)}</td></tr>`)
    .join("")}</table><p style="font:15px/1.5 sans-serif;white-space:pre-wrap">${escape(text)}</p>`;

  const to = process.env.ADMIN_EMAIL?.trim() || SALES_EMAIL;
  const ok = await sendEmail({ to, subject, html, text: plain, replyTo: user.email ?? null });
  if (!ok) console.error("[help] report not sent", { who, where });
  return { ok };
}
