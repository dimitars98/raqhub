import { ImageResponse } from "next/og";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { makeLabels } from "@/lib/labels";
import { routing } from "@/i18n/routing";
import { siteUrl, visitorClient } from "@/lib/directory";

// What a league, tournament or Americano link looks like when it's shared
// (WhatsApp, Instagram, Facebook, LinkedIn, Google): its title, a short
// description and a picture card made from the event's own details.
// Everything here is read as a visitor, so it shows only what's public.

export type EventKind = "league" | "tournament" | "americano";

export type EventCard = {
  kind: EventKind;
  id: string;
  name: string;
  sport: string;
  status: string;
  /** Americano or Mexicano, for evenings. */
  format?: string;
  /** yyyy-mm-dd for leagues and tournaments; an ISO time for evenings. */
  start: string;
  end?: string;
  club: string;
  city: string | null;
};

const PATH: Record<EventKind, string> = {
  league: "leagues",
  tournament: "tournaments",
  americano: "americano",
};

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
type Club = { name: string; city: string | null } | null;

/** The public details of one event, or null if there's no such event. */
export async function loadEventCard(kind: EventKind, id: string): Promise<EventCard | null> {
  if (!isId(id) || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const db = visitorClient();
    if (kind === "americano") {
      const { data } = await db
        .from("social_events")
        .select("name, sport, status, format, starts_at, ends_at, club:clubs(name, city)")
        .eq("id", id)
        .maybeSingle();
      if (!data) return null;
      const club = data.club as unknown as Club;
      return {
        kind, id, name: data.name, sport: data.sport, status: data.status, format: data.format,
        start: data.starts_at, end: data.ends_at, club: club?.name ?? "", city: club?.city ?? null,
      };
    }
    const { data } = await db
      .from(kind === "league" ? "leagues" : "tournaments")
      .select("name, sport, status, starts_on, club:clubs(name, city)")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const club = (data as { club: unknown }).club as Club;
    return {
      kind, id, name: data.name, sport: data.sport, status: data.status,
      start: data.starts_on, club: club?.name ?? "", city: club?.city ?? null,
    };
  } catch (error) {
    console.error("loadEventCard failed:", error);
    return null;
  }
}

/** The texts both the link preview and the picture use, in this language. */
async function texts(card: EventCard, locale: string) {
  const t = await getTranslations({ locale, namespace: "sharePreview" });
  const labels = makeLabels(await getTranslations({ locale, namespace: "labels" }));
  const df = dateLocale(locale);
  const kind =
    card.kind === "americano"
      ? t(card.format === "mexicano" ? "kind.mexicano" : "kind.americano")
      : t(`kind.${card.kind}`);
  const when =
    card.kind === "americano"
      ? `${format(new Date(card.start), "EEE d MMM, HH:mm", { locale: df })}${
          card.end ? `–${format(new Date(card.end), "HH:mm")}` : ""
        }`
      : format(new Date(`${card.start}T12:00:00`), "EEE d MMM yyyy", { locale: df });
  const status = t.has(`status.${card.status}`) ? t(`status.${card.status}`) : "";
  const place = [card.club, card.city].filter(Boolean).join(", ");
  return { t, kind, sport: labels.sport(card.sport), when, status, place };
}

/** Title, description and link-preview tags for an event's page. */
export async function eventMetadata(card: EventCard | null, locale: string): Promise<Metadata> {
  if (!card) return {};
  const { t, kind, sport, when, place } = await texts(card, locale);
  const path = `/${PATH[card.kind]}/${card.id}`;
  const title = `${card.name} · ${card.club}`;
  const description = t("description", { kind, sport, place, when });
  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl()}/${locale}${path}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${siteUrl()}/${l}${path}`])),
    },
    // The picture itself comes from opengraph-image.tsx next to the page.
    openGraph: {
      title,
      description,
      url: `${siteUrl()}/${locale}${path}`,
      siteName: "RaqHub",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * A font that has every letter in `text` (Cyrillic too), from Google Fonts.
 * Null if it can't be fetched: the card then uses the built-in font.
 */
async function loadFont(text: string, weight: number) {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Noto+Sans:wght@${weight}&text=${encodeURIComponent(text)}`,
      )
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

/** The 1200×630 picture shown with a shared link. */
export async function eventImage(card: EventCard | null, locale: string) {
  const info = card ? await texts(card, locale) : null;
  const top = info ? `${info.kind} · ${info.sport}` : "RaqHub";
  const title = card?.name ?? "RaqHub";
  const place = info?.place ?? "";
  const when = info?.when ?? "";
  const status = info?.status ?? "";
  const all = `RaqHub${top}${title}${place}${when}${status}`;
  const [regular, bold] = await Promise.all([loadFont(all, 500), loadFont(all, 800)]);
  const fonts = [
    ...(regular ? [{ name: "Noto Sans", data: regular, weight: 500 as const, style: "normal" as const }] : []),
    ...(bold ? [{ name: "Noto Sans", data: bold, weight: 800 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#111c0a",
          color: "#ffffff",
          padding: "64px 72px",
          // Only set when the font loaded: an undefined style breaks the picture.
          ...(fonts.length ? { fontFamily: "Noto Sans" } : {}),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>
            <span>Raq</span>
            <span style={{ color: "#a8d832" }}>Hub</span>
          </div>
          {status && (
            <div
              style={{
                display: "flex",
                background: "#a8d832",
                color: "#111c0a",
                fontSize: 26,
                fontWeight: 800,
                padding: "10px 24px",
                borderRadius: 999,
              }}
            >
              {status}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: "#d6f09a", textTransform: "uppercase", letterSpacing: 2 }}>
            {top}
          </div>
          <div style={{ display: "flex", fontSize: title.length > 40 ? 64 : 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            {title}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 32, fontWeight: 500, color: "#c9d4c1" }}>
          {place && <div style={{ display: "flex" }}>{place}</div>}
          {when && <div style={{ display: "flex" }}>{when}</div>}
        </div>
      </div>
    ),
    // No fonts at all would break the picture; then the built-in one is used.
    fonts.length ? { ...OG_SIZE, fonts } : OG_SIZE,
  );
}
