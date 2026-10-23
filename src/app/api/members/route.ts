import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Member, MembershipPlan } from "@/types/database";
import { getMyClub } from "@/lib/myClub";

// The browser shows its own translated messages; details stay in the server log.
function handleError(error: unknown) {
  const err = error as {
    code?: string;
    message?: string;
    detail?: string;
  } | null;
  // The club's free trial has ended (see 20261025_trial_lock.sql).
  if (err?.message?.includes("club_locked")) {
    return NextResponse.json({ error: "readOnly" }, { status: 403 });
  }
  if (err?.code === "23505") {
    const field = err.message?.includes("email") ? "email" : "phone";
    return NextResponse.json({ error: "duplicate", field }, { status: 409 });
  }
  console.error("[members]", error);
  return NextResponse.json({ error: "failed" }, { status: 500 });
}

/** The request body, or null when it isn't valid JSON. */
async function readBody(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const badRequest = () => NextResponse.json({ error: "invalid" }, { status: 400 });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readBody(request);
  if (!body) return badRequest();

  // The club the signed-in admin owns, or is staff of
  const { club } = await getMyClub<{ id: string }>(supabase, user.id, "id");
  if (!club)
    return NextResponse.json({ error: "No club found" }, { status: 403 });

  const { data, error } = (await supabase
    .from("members")
    .insert({ ...body, club_id: club.id } as unknown as never)
    .select("*, plan:membership_plans(id, name, price, billing_period)")
    .single()) as {
    data: (Member & { plan?: MembershipPlan | null }) | null;
    error: unknown;
  };

  if (error) return handleError(error);
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readBody(request);
  if (!body || typeof body.id !== "string") return badRequest();
  const { id, ...rest } = body;

  const { data, error } = (await supabase
    .from("members")
    .update(rest as unknown as never)
    .eq("id", id)
    .select("*, plan:membership_plans(id, name, price, billing_period)")
    .single()) as {
    data: (Member & { plan?: MembershipPlan | null }) | null;
    error: unknown;
  };

  if (error) return handleError(error);
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readBody(request);
  if (!body || typeof body.id !== "string") return badRequest();
  const id = body.id;

  const { error } = await supabase
    .from("members")
    .update({ status: "cancelled" } as unknown as never)
    .eq("id", id);

  if (error) return handleError(error);
  return NextResponse.json({ success: true });
}
