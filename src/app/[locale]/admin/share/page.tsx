import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { clubLink, qrSvg } from "@/lib/share";
import ShareClient from "@/components/admin/ShareClient";

/**
 * "Share with your players": the club's booking link, a QR code, a printable
 * poster and a ready-made message for WhatsApp or Viber, all in the language
 * the admin is using.
 */
export default async function SharePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: club } = await supabase
    .from("clubs")
    .select("name, slug")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!club) redirect("/admin/setup");

  const locale = await getLocale();
  const t = await getTranslations("share");
  const link = clubLink(locale, club.slug);

  return (
    <ShareClient
      link={link}
      qr={await qrSvg(link)}
      message={t("message", { club: club.name, link })}
      posterHref={`/clubs/${club.slug}/poster`}
      fileName={`${club.slug}-qr.svg`}
    />
  );
}
