import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ErrorState from "@/components/ui/ErrorState";

// Shown for notFound() and for addresses that don't exist ([...rest]).
export default async function NotFound() {
  const t = await getTranslations("errorPage");
  return (
    <ErrorState
      title={t("notFoundTitle")}
      body={t("notFoundBody")}
      actions={
        <Link href="/" className="btn-primary h-11 justify-center px-6">
          {t("home")}
        </Link>
      }
    />
  );
}
