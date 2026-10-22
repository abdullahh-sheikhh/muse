import { describe, expect, it } from "vitest";
import { assertAgentAccess, SESSION_SECONDS, safeSearchResult, startAgentInput, visitedTitles } from "@/lib/agent-rules";

describe("Pro voice rules", () => {
  it("rejects non-partner museums even with no prior sessions", () => {
    expect(() => assertAgentAccess(false, 0)).toThrow("Pro feature");
  });
  it("allows nine starts but rejects ten starts per hour", () => {
    expect(() => assertAgentAccess(true, 9)).not.toThrow();
    expect(() => assertAgentAccess(true, 10)).toThrow("limit");
  });
  it("ends after five minutes", () => expect(SESSION_SECONDS).toBe(300));
  it("accepts BCP-47 and rejects malformed languages", () => {
    const artworkId = "10000000-0000-4000-8000-000000000001";
    expect(startAgentInput.safeParse({ artworkId, language: "pt-BR" }).success).toBe(true);
    expect(startAgentInput.safeParse({ artworkId, language: "not a language" }).success).toBe(false);
  });
  it("includes at most eight distinct previously opened artworks, excluding the current one", () => {
    const arts = Array.from({ length: 12 }, (_, i) => ({ id: `${i}`, title: `Artwork ${i}` }));
    const result = visitedTitles([...arts.map((art) => ({ artwork_id: art.id })), { artwork_id: "1" }], arts, "0");
    expect(result.split(", ")).toHaveLength(8);
    expect(result).not.toContain("Artwork 0");
  });
  it("excludes commerce results and bounds search to 1500 characters", () => {
    const result = safeSearchResult([{ title: "shop", url: "https://example.org/shop", snippet: "x" }, { title: "Museum", url: "https://museum.org/art", snippet: "x".repeat(2000) }]);
    expect(result.sources).toEqual([{ title: "Museum", url: "https://museum.org/art" }]);
    expect(result.result).toHaveLength(1500);
  });
});