import { eventImage, loadEventCard, OG_SIZE } from "@/lib/sharePreview";

// The picture shown when this page's link is shared (see src/lib/sharePreview.tsx).
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "RaqHub";

export default async function Image({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  return eventImage(await loadEventCard("americano", id), locale);
}
