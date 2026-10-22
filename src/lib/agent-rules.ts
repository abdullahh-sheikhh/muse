import { z } from "zod";
import { isLanguageTag } from "./guide-languages";

export const SESSION_SECONDS = 300;
export const startAgentInput = z.object({
  artworkId: z.string().uuid(),
  language: z.string().max(35).refine(isLanguageTag, "Invalid guide language"),
});

export function assertAgentAccess(isPartner: boolean, starts: number) {
  if (!isPartner) throw new Error("Ask the guide is a Pro feature at partner museums");
  if (starts >= 10) throw new Error("You've reached the limit, try again later");
}

export function visitedTitles(rows: { artwork_id: string | null }[], artworks: { id: string; title: string }[], currentId: string) {
  const ids = new Set(rows.map((row) => row.artwork_id).filter((id) => id !== currentId));
  return [...new Set(artworks.filter((art) => ids.has(art.id)).map((art) => art.title))].slice(0, 8).join(", ");
}

export function safeSearchResult(hits: { title: string; url: string; snippet: string }[]) {
  const safe = hits.filter((hit) => !["boutique", "shop", "store"].some((word) => hit.url.toLowerCase().includes(word))).slice(0, 3);
  return {
    result: safe.map((hit) => `${hit.title}: ${hit.snippet}`).join("\n").slice(0, 1500) || "No additional information found.",
    sources: safe.map(({ title, url }) => ({ title, url })),
  };
}