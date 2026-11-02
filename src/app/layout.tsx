import type { Metadata } from "next";
import "./globals.css";
import { ReactNode } from "react";

export const metadata: Metadata = {
  // The site's address, so shared-link pictures (opengraph-image) get a full
  // https://raqhub.com/... URL instead of a localhost one.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://raqhub.com"),
  title: { default: "RaqHub", template: "%s | RaqHub" },
  description: "Book tennis, padel and pickleball courts and coaches near you.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
