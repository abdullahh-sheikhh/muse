import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { safeSearchResult } from "@/lib/agent-rules";

export const Route = createFileRoute("/api/public/agent-tools/search-art")({
  server: { handlers: {
    POST: async ({ request }) => {
      const secret = process.env["MUSE_TOOL_SECRET"];
      if (!secret || request.headers.get("x-muse-tool-secret") !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
      try {
        const { question } = z.object({ question: z.string().trim().min(1).max(2000) }).parse(await request.json());
        const key = process.env["KEENABLE_API_KEY"];
        if (!key) throw new Error("Search not configured");
        const { keenableSearch } = await import("@/lib/guide.server");
        return Response.json(safeSearchResult(await keenableSearch(key, question, 3)));
      } catch (error) {
        console.error("Agent search failed", error);
        return Response.json({ result: "No additional information found." });
      }
    },
  } },
});