import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Club } from "@/types/database";
import SettingsClient from "@/components/admin/SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clubData } = await supabase
    .from("clubs")
    .select(
      "id, name, email, phone, address, city, country, description, logo_url",
    )
    .eq("owner_id", user.id)
    .single();

  const club = clubData as Pick<
    Club,
    | "id"
    | "name"
    | "email"
    | "phone"
    | "address"
    | "city"
    | "country"
    | "description"
    | "logo_url"
  > | null;

  if (!club) redirect("/admin/setup");

  return <SettingsClient club={club} />;
}
