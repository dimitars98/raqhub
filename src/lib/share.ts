import QRCode from "qrcode";
import { appUrl } from "@/lib/email/bookings";

/** The public club page players open to see courts and book. */
export function clubLink(locale: string, slug: string) {
  return `${appUrl()}/${locale}/clubs/${slug}`;
}

/** QR code for a link, as an SVG string. Dark green on white, like the site. */
export function qrSvg(link: string) {
  return QRCode.toString(link, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111c0aff", light: "#ffffffff" },
  });
}
