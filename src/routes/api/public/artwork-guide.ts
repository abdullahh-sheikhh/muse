import { createFileRoute } from "@tanstack/react-router";
import { lang } from "@/lib/languages";

// Public visitor endpoint: writes and voices a guide script for one artwork.
// Returns { script_text, audio_url } where audio_url is a short-lived signed URL
// (signed URLs support range requests, which iOS needs for playback).
export const Route = createFileRoute("/api/public/artwork-guide")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const artworkId = body?.artwork_id;
        const language = body?.language;
        if (
          typeof artworkId !== "string" ||
          !/^[0-9a-f-]{36}$/.test(artworkId) ||
          typeof language !== "string" ||
          !/^[a-z]{2}$/.test(language)
        ) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: art } = await supabaseAdmin
          .from("artifacts")
          .select("*, museums(name, city)")
          .eq("id", artworkId)
          .maybeSingle();
        if (!art) return Response.json({ error: "Not found" }, { status: 404 });

        const { data: facts } = await supabaseAdmin
          .from("artwork_facts")
          .select("label")
          .eq("artwork_id", artworkId)
          .order("sort_order");

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "AI is not configured" }, { status: 500 });

        try {
          const { writeGuideScript, synthesize } = await import("@/lib/ai.server");
          const museum = art.museums as { name: string; city: string } | null;
          const script = await writeGuideScript(
            apiKey,
            {
              title: art.title,
              artist: art.artist,
              year: art.year,
              room: art.room,
              museumName: museum?.name ?? "",
              facts: (facts ?? []).map((f) => f.label),
            },
            lang(language).english,
          );

          const wav = await synthesize(apiKey, script);
          const path = `guides/${artworkId}/${language}.wav`;
          const up = await supabaseAdmin.storage
            .from("audio")
            .upload(path, wav, { contentType: "audio/wav", upsert: true });
          if (up.error) throw new Error(up.error.message);

          const { data: signed, error: signErr } = await supabaseAdmin.storage
            .from("audio")
            .createSignedUrl(path, 60 * 60 * 6);
          if (signErr || !signed) throw new Error("Could not sign audio URL");

          return Response.json({ script_text: script, audio_url: signed.signedUrl });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Guide generation failed";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
