import { createFileRoute } from "@tanstack/react-router";

// Public visitor endpoint: find a museum by free-text search. Checks the
// database first; only searches the web (Keenable + AI) when the museum is
// unknown, then stores it so later visitors get it instantly.
// Always answers JSON {ok, museum?, error?}.
const SYSTEM_OWNER = "00000000-0000-0000-0000-000000000000";

export const Route = createFileRoute("/api/public/discover-museum")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fail = (error: string, status = 200) => Response.json({ ok: false, error }, { status });
        const body = await request.json().catch(() => null);
        const query = typeof body?.query === "string" ? body.query.trim().slice(0, 120) : "";
        if (query.length < 3) return fail("Type at least 3 characters", 400);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const d = await import("@/lib/discover.server");

          // a) already known? match by name (and optionally city) — the cache.
          const { data: existing } = await supabaseAdmin
            .from("museums")
            .select("id, name, slug, city, country")
            .ilike("name", `%${query.replace(/[%_]/g, "")}%`)
            .limit(5);
          if (existing && existing.length > 0) {
            return Response.json({ ok: true, museum: existing[0], matches: existing, cached: true });
          }

          // b) web search + structuring
          const keenKey = process.env["KEENABLE_API_KEY"];
          const aiKey = process.env["LOVABLE_API_KEY"];
          if (!keenKey || !aiKey) return fail("Search is not configured");
          let found;
          try {
            found = await d.discoverMuseum(keenKey, aiKey, query);
          } catch (e) {
            console.error("[discover-museum] Keenable/AI failed:", e);
            return fail("Couldn't search right now — try again in a moment");
          }
          if (!found) return fail("No museum found for that search");

          // c) store once, reuse forever
          const base = d.slugify(`${found.name}-${found.city}`) || "museum";
          let slug = base;
          for (let i = 2; ; i++) {
            const { data: clash } = await supabaseAdmin
              .from("museums")
              .select("id")
              .eq("slug", slug)
              .maybeSingle();
            if (!clash) break;
            slug = `${base}-${i}`;
          }
          const { data: inserted, error } = await supabaseAdmin
            .from("museums")
            .insert({
              owner_id: SYSTEM_OWNER,
              name: found.name,
              slug,
              city: found.city,
              country: found.country,
              lat: found.lat,
              lng: found.lng,
              intro: found.intro,
              image_url: found.image_url,
            })
            .select("id, name, slug, city, country")
            .single();
          if (error || !inserted) {
            console.error("[discover-museum] insert failed:", error);
            return fail("Couldn't save the museum", 502);
          }
          return Response.json({ ok: true, museum: inserted, cached: false });
        } catch (e) {
          console.error("[discover-museum]", e);
          return fail("Search failed", 502);
        }
      },
    },
  },
});
