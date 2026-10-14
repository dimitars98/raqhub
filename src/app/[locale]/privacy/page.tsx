import type { Metadata } from "next";
import LegalPage, { legalTitle } from "@/components/legal/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await legalTitle("privacy") };
}

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
