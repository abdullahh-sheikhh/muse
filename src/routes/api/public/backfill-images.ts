import { createFileRoute } from "@tanstack/react-router";

// Public visitor endpoint: fill in missing museum/artwork photos from the
// web, once. Only rows without an image_url are touched, and every found
// photo is stored in the database so the web is never queried twice.
// Photos are only kept when their source verifies the subject (official site
// or Wikipedia/Wikimedia) — see trustedImage in discover.server.ts.
export const Route = createFileRoute("/api/public/backfill-images")({
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
            .select("id, name, city, image_url")
            .eq("id", museumId)
            .maybeSingle();
          if (!museum) return fail("Museum not found", 404);

          const { data: missing } = await supabaseAdmin
            .from("artifacts")
            .select("id, title, artist")
            .eq("museum_id", museumId)
            .is("image_url", null)
            .order("sort_order")
            .limit(12);

          const needsMuseum = !museum.image_url;
          if (!needsMuseum && (!missing || missing.length === 0)) {
            return Response.json({ ok: true, filled: 0, cached: true });
          }

          const keenKey = process.env["KEENABLE_API_KEY"];
          const aiKey = process.env["LOVABLE_API_KEY"];
          if (!keenKey || !aiKey) return fail("Search is not configured");
          const d = await import("@/lib/discover.server");

          let filled = 0;
          if (needsMuseum) {
            try {
              const url = await d.findSubjectImage(keenKey, aiKey, museum.name, `museum in ${museum.city}`);
              if (url) {
                await supabaseAdmin.from("museums").update({ image_url: url }).eq("id", museumId);
                filled += 1;
              }
            } catch (e) {
              console.error("[backfill-images] museum photo failed:", e);
            }
          }

          for (const art of missing ?? []) {
            try {
              const url = await d.findSubjectImage(
                keenKey,
                aiKey,
                `${art.title}${art.artist ? ` by ${art.artist}` : ""}`,
                `artwork at ${museum.name}`,
              );
              if (url) {
                await supabaseAdmin.from("artifacts").update({ image_url: url }).eq("id", art.id);
                filled += 1;
              }
            } catch (e) {
              console.error("[backfill-images] artwork photo failed:", e);
            }
          }

          return Response.json({ ok: true, filled });
        } catch (e) {
          console.error("[backfill-images]", e);
          return fail("Couldn't load photos right now", 502);
        }
      },
    },
  },
});
