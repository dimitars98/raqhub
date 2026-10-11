import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Member, MembershipPlan } from "@/types/database";

function handleError(error: unknown) {
  const err = error as {
    code?: string;
    message?: string;
    detail?: string;
  } | null;
  if (err?.code === "23505") {
    const field = err.message?.includes("email") ? "email" : "phone";
    return NextResponse.json(
      { field, message: `A member with this ${field} already exists.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ error }, { status: 500 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { data: clubData } = await supabase
    .from("clubs")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  const club = clubData as { id: string } | null;
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

  const body = await request.json();
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

  const { id } = await request.json();

  const { error } = await supabase
    .from("members")
    .update({ status: "cancelled" } as unknown as never)
    .eq("id", id);

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true });
}
