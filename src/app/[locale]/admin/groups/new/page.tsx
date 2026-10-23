import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { BILLING_COLUMNS, clubAccess, type ClubBilling } from "@/lib/plans";
import { ReadOnlyNotice, UpgradeNotice } from "@/components/admin/PlanNotices";
import GroupForm from "@/components/groups/GroupForm";
import { groupFormOptions } from "@/lib/groupForm";
import { clubDay } from "@/lib/groups";
import { Link } from "@/i18n/navigation";

export default async function NewGroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { club } = await getMyClub<{ id: string } & ClubBilling>(supabase, user.id, `id, ${BILLING_COLUMNS}`);
  if (!club) redirect("/admin/setup");
  const access = clubAccess(club);
  if (access.readOnly) return <ReadOnlyNotice />;
  if (!access.has("groups")) return <UpgradeNotice feature="groups" />;

  const options = await groupFormOptions(supabase, club.id);
  if (options.courts.length === 0) {
    const t = await getTranslations("groups.form");
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-ink-900">{t("noCourtsTitle")}</h1>
        <p className="mt-2 text-sm text-ink-600">{t("noCourtsBody")}</p>
        <Link href="/admin/courts" className="btn-primary mt-6">
          {t("addCourt")}
        </Link>
      </div>
    );
  }
  return <GroupForm {...options} today={clubDay(new Date())} />;
}
