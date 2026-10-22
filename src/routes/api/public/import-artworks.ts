import { createFileRoute } from "@tanstack/react-router";

// Public visitor endpoint: fill a museum's artwork list from the web, once.
// If the museum already has artworks, returns them without any web call.
// Always answers JSON {ok, artworks?, imported?, error?}.
export const Route = createFileRoute("/api/public/import-artworks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fail = (error: string, status = 200) => Response.json({ ok: false, error }, { status });
        const body = await request.json().catch(() => null);
        const museumId = body?.museum_id;
        if (typeof museumId !== "string" || !/^[0-9a-f-]{36}$/.test(museumId)) {
          return fail("Invalid input", 400);
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: museum } = await supabaseAdmin
            .from("museums")
            .select("id, name, city")
            .eq("id", museumId)
            .maybeSingle();
          if (!museum) return fail("Museum not found", 404);

          // a) cache: artworks already stored → no web call
          const { data: existing } = await supabaseAdmin
            .from("artifacts")
            .select("id, ref, title, artist, image_url, sort_order")
            .eq("museum_id", museumId)
            .order("sort_order");
          if (existing && existing.length > 0) {
            return Response.json({ ok: true, artworks: existing, imported: 0, cached: true });
          }

          // b) web search + structuring
          const keenKey = process.env["KEENABLE_API_KEY"];
          const aiKey = process.env["LOVABLE_API_KEY"];
          if (!keenKey || !aiKey) return fail("Search is not configured");
          const d = await import("@/lib/discover.server");
          let artworks;
          try {
            artworks = await d.discoverArtworks(keenKey, aiKey, museum.name, museum.city);
          } catch (e) {
            console.error("[import-artworks] Keenable/AI failed:", e);
            return fail("Couldn't load artworks right now — try again in a moment");
          }
          if (artworks.length === 0) return fail("No artworks found for this museum yet");

          // c) store once
          const rows = artworks.map((a, i) => ({
            museum_id: museumId,
            ref: a.ref,
            title: a.title,
            artist: a.artist,
            year: a.year,
            room: a.room,
            description: a.description,
            image_url: a.image_url,
            sort_order: i + 1,
          }));
          const { data: inserted, error } = await supabaseAdmin
            .from("artifacts")
            .upsert(rows, { onConflict: "museum_id,ref", ignoreDuplicates: true })
            .select("id, ref, title, artist, image_url, sort_order");
          if (error) {
            console.error("[import-artworks] insert failed:", error);
            return fail("Couldn't save the artworks", 502);
          }
          return Response.json({ ok: true, artworks: inserted ?? [], imported: inserted?.length ?? 0 });
        } catch (e) {
          console.error("[import-artworks]", e);
          return fail("Import failed", 502);
        }
      },
    },
  },
});
