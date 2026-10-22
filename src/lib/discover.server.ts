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
// the museum itself — never a random image from an unrelated page.
function trustedImage(url: unknown, hits: SearchHit[]): string | null {
  if (typeof url !== "string" || !url.startsWith("https://")) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const ok = hits.some((h) => {
      try {
        const hHost = new URL(h.url).hostname.replace(/^www\./, "");
        return host === hHost || host.endsWith(`.${hHost}`) || hHost.endsWith(`.${host}`);
      } catch {
        return false;
      }
    });
    return ok ? url : null;
  } catch {
    return null;
  }
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
    `You turn web search results into a structured list of real artworks held by a museum. Return ONLY a JSON array of up to 12 items, each with keys: title, artist, year, room (gallery or room name, "" if unknown), description (one factual sentence, max 200 chars). Only include artworks the results actually attribute to this museum; never invent. If none are clearly identified, return [].`,
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
    }))
    .filter((a) => a.title);
}
