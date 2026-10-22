"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { clubFormat, money, scheduleText } from "@/lib/groups";
import { respondOffer } from "@/app/actions/groups";

export type OfferInfo = {
  name: string;
  status: string;
  expires_at: string | null;
  expired: boolean;
  group: string;
  days: number[];
  start_time: string;
  end_time: string;
  price: number;
  kind: string;
  club: string;
  club_slug: string;
  club_phone: string | null;
};

export default function OfferClient({ token, info }: { token: string; info: OfferInfo | null }) {
  const t = useTranslations("groupOffer");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [answer, setAnswer] = useState<"active" | "left" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (answer || !info || info.status !== "offered" || info.expired) {
    const title = answer === "active" ? t("acceptedTitle") : answer === "left" ? t("declinedTitle") : t("closedTitle");
    const body =
      answer === "active"
        ? t("acceptedBody", { name: info?.name ?? "", group: info?.group ?? "" })
        : answer === "left"
          ? t("declinedBody")
          : info?.expired
            ? t("expiredBody", { club: info.club })
            : t("closedBody");
    return (
      <div className="rounded-[20px] border border-ink-100 bg-white p-8 text-center">
        <CheckCircle2
          size={30}
          className={`mx-auto mb-3 ${answer === "active" ? "text-brand-600" : "text-ink-400"}`}
          aria-hidden="true"
        />
        <h1 className="text-xl font-bold text-ink-900">{title}</h1>
        <p className="mt-2 text-sm text-ink-600">{body}</p>
        {info?.club_slug && (
          <Link href={`/clubs/${info.club_slug}`} className="btn-secondary mt-6 inline-flex">
            {t("toClub", { club: info.club })}
          </Link>
        )}
      </div>
    );
  }

  const respond = (accept: boolean) =>
    startTransition(async () => {
      setError(null);
      const r = await respondOffer(token, accept);
      if (r.error) setError(t(`errors.${r.error}`));
      else setAnswer(accept ? "active" : "left");
    });

  return (
    <div className="overflow-hidden rounded-[20px] border border-ink-100 bg-white">
      <div className="flex flex-col gap-1.5 bg-ink-900 p-6 text-white">
        <span className="text-xs font-semibold text-brand-200">{info.club}</span>
        <h1 className="text-2xl font-bold">{t("title", { name: info.name })}</h1>
        <p className="text-sm text-ink-200">{t("intro", { group: info.group })}</p>
      </div>
      <div className="flex flex-col gap-4 p-6">
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-600">{t("group")}</dt>
            <dd className="text-right font-semibold text-ink-900">{info.group}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-600">{t("when")}</dt>
            <dd className="text-right font-semibold text-ink-900">{scheduleText(info, locale)}</dd>
          </div>
          {Number(info.price) > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-600">{t("price")}</dt>
              <dd className="text-right font-semibold text-ink-900">{t("perMonth", { price: money(Number(info.price)) })}</dd>
            </div>
          )}
        </dl>
        {info.expires_at && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
            <Clock size={15} aria-hidden="true" />
            {t("answerBy", {
              date: clubFormat(info.expires_at, locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
            })}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={pending} onClick={() => respond(true)} className="btn-primary btn-lg flex-1 justify-center">
            {t("accept")}
          </button>
          <button type="button" disabled={pending} onClick={() => respond(false)} className="btn-secondary btn-lg flex-1">
            {t("decline")}
          </button>
        </div>
        {info.club_phone && <p className="text-center text-xs text-ink-600">{t("questions", { phone: info.club_phone })}</p>}
      </div>
    </div>
  );
}
