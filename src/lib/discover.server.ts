// Server-only helpers for live museum discovery and artwork import:
// Keenable search results are structured by the built-in AI, then stored
// in the database so each museum/artwork is fetched from the web only once.
import { keenableSearch, runText, type SearchHit } from "./guide.server";

export type DiscoveredMuseum = {
  name: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  intro: string;
  image_url: string | null;
};

export type DiscoveredArtwork = {
  ref: string;
  title: string;
  artist: string;
  year: string;
  room: string;
  description: string;
  image_url: string | null;
};

function parseJson<T>(text: string): T | null {
  const match = text.replace(/```(?:json)?/gi, "").match(/[\[{][\s\S]*[\]}]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function cleanString(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// Only keep a photo when its URL host matches one of the Keenable hits about
// the subject itself — never a random image from an unrelated page.
// Wikimedia Commons files (upload.wikimedia.org) are trusted when a Wikipedia
// or Wikimedia page about the subject is among the hits: those are real,
// attributable photos of the actual item.
function trustedImage(url: unknown, hits: SearchHit[]): string | null {
  if (typeof url !== "string" || !url.startsWith("https://")) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const ok = hits.some((h) => {
      try {
        const hHost = new URL(h.url).hostname.replace(/^www\./, "");
        if (host === hHost || host.endsWith(`.${hHost}`) || hHost.endsWith(`.${host}`)) return true;
        return (
          (host === "upload.wikimedia.org" || host.endsWith(".wikimedia.org")) &&
          (hHost.endsWith("wikipedia.org") || hHost.endsWith("wikimedia.org"))
        );
      } catch {
        return false;
      }
    });
    return ok ? url : null;
  } catch {
    return null;
  }
}

// Wikipedia's own API hands us the lead image of the article about the exact
// subject — a real, attributable photo, never a guess.
async function wikipediaImage(subject: string): Promise<string | null> {
  try {
    const search = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=1&search=${encodeURIComponent(subject)}`,
    );
    const titles = (await search.json()) as unknown[];
    const title = Array.isArray(titles?.[1]) ? (titles[1] as unknown[])[0] : null;
    if (typeof title !== "string" || !title) return null;
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      originalimage?: { source?: string };
      thumbnail?: { source?: string };
    };
    const url = data.originalimage?.source ?? data.thumbnail?.source;
    if (typeof url !== "string" || !url.startsWith("https://")) return null;
    try {
      return new URL(url).hostname.endsWith("wikimedia.org") ? url : null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

// Find one verified photo of a subject (museum or artwork) from the web.
export async function findSubjectImage(
  keenKey: string,
  aiKey: string,
  subject: string,
  context: string,
): Promise<string | null> {
  try {
    const hits = await keenableSearch(keenKey, `${subject} ${context} wikipedia`, 5);
    if (hits.length > 0) {
      const text = await runText(
        aiKey,
        `You find a real photo of a specific subject. Return ONLY a JSON object with key image_url: a direct https image URL (ending in .jpg, .jpeg, .png or .webp) that depicts exactly this subject, taken from one of the sources or their Wikimedia Commons file pages. If no result clearly shows this exact subject, return {"image_url": null}. Never guess or invent URLs.`,
        `Subject: ${subject} (${context})\n\nResults:\n${hits.map((h) => `- ${h.title} (${h.url}): ${h.snippet}`).join("\n")}`,
      );
      const raw = parseJson<Record<string, unknown>>(text);
      const url = raw ? trustedImage(raw["image_url"], hits) : null;
      if (url) return url;
    }
  } catch {
    // fall through to the Wikipedia lookup
  }
  // "The Lacemaker by Johannes Vermeer" rarely matches an article title;
  // retry with the bare title when the full subject misses.
  const bare = subject.split(" by ")[0]?.trim();
  return (await wikipediaImage(subject)) ?? (bare && bare !== subject ? await wikipediaImage(bare) : null);
}

export async function discoverMuseum(
  keenKey: string,
  aiKey: string,
  query: string,
): Promise<DiscoveredMuseum | null> {
  const hits = await keenableSearch(keenKey, `${query} museum official site`, 6);
  if (hits.length === 0) return null;
  const text = await runText(
    aiKey,
    `You turn web search results into structured museum data. Return ONLY a JSON object with keys: name (official museum name), city, country (English name), lat (number or null), lng (number or null), intro (one sentence, max 160 chars), image_url (a direct https image URL of the actual museum building or interior from one of the sources, or null). If the results are not clearly about one real museum, return null.`,
    `Query: ${query}\n\nResults:\n${hits.map((h) => `- ${h.title} (${h.url}): ${h.snippet}`).join("\n")}`,
  );
  const raw = parseJson<Record<string, unknown>>(text);
  if (!raw || !cleanString(raw["name"]) || !cleanString(raw["city"])) return null;
  return {
    name: cleanString(raw["name"], 120),
    city: cleanString(raw["city"], 80),
    country: cleanString(raw["country"], 80),
    lat: cleanNumber(raw["lat"]),
    lng: cleanNumber(raw["lng"]),
    intro: cleanString(raw["intro"], 200),
    image_url: trustedImage(raw["image_url"], hits),
  };
}

export async function discoverArtworks(
  keenKey: string,
  aiKey: string,
  museumName: string,
  city: string,
): Promise<DiscoveredArtwork[]> {
  const hits = await keenableSearch(keenKey, `notable artworks highlights collection ${museumName} ${city}`, 6);
  if (hits.length === 0) return [];
  const text = await runText(
    aiKey,
    `You turn web search results into a structured list of real artworks held by a museum. Return ONLY a JSON array of up to 12 items, each with keys: title, artist, year, room (gallery or room name, "" if unknown), description (one factual sentence, max 200 chars), image_url (a direct https image URL of that exact artwork from one of the sources or Wikimedia Commons, or null). Only include artworks the results actually attribute to this museum; never invent titles, facts, or URLs. If none are clearly identified, return [].`,
    `Museum: ${museumName}, ${city}\n\nResults:\n${hits.map((h) => `- ${h.title} (${h.url}): ${h.snippet}`).join("\n")}`,
  );
  const raw = parseJson<Record<string, unknown>[]>(text);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => ({
      ref: `A-${String(i + 1).padStart(3, "0")}`,
      title: cleanString(item["title"], 160),
      artist: cleanString(item["artist"], 120),
      year: cleanString(item["year"], 40),
      room: cleanString(item["room"], 80),
      description: cleanString(item["description"], 240),
      image_url: trustedImage(item["image_url"], hits),
    }))
    .filter((a) => a.title);
}
