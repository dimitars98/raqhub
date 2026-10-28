"use client";

import { useTranslations } from "next-intl";

/**
 * A booking's online payment for the club: paid, waiting, refund on its way,
 * refunded. Nothing for bookings paid at the club.
 */
export default function PaymentTag({ status, className = "" }: { status?: string | null; className?: string }) {
  const t = useTranslations("payments.tag");
  if (!status || status === "none" || status === "expired") return null;
  const tone =
    status === "paid"
      ? "bg-[#f1f9dc] text-[#2e4d03]"
      : status === "pending"
        ? "bg-[#fdf5df] text-[#7a5600]"
        : "bg-[#f3f5f0] text-[#3d4f35]";
  const key = status === "refund_due" ? "refundDue" : status;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone} ${className}`}>
      {t(key)}
    </span>
  );
}
