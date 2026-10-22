import { createFileRoute } from "@tanstack/react-router";
import { isLanguageTag } from "@/lib/guide-languages";

// Public visitor endpoint. Returns cached guide or writes facts → narration → ElevenLabs speech.
// Always answers JSON {ok, script_text?, audio_url?, sources?, error?, tts_error?}.
type Source = { title: string; url: string | null };

export const Route = createFileRoute("/api/public/artwork-guide")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fail = (error: string, status = 200) => Response.json({ ok: false, error }, { status });
        const body = await request.json().catch(() => null);
        const artworkId = body?.artwork_id;
        const language = body?.language;
        if (
          typeof artworkId !== "string" ||
          !/^[0-9a-f-]{36}$/.test(artworkId) ||
          typeof language !== "string" ||
          !isLanguageTag(language)
        ) {
          return fail("Invalid input", 400);
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const g = await import("@/lib/guide.server");

          const sign = async (path: string | null) => {
            if (!path) return null;
            const { data } = await supabaseAdmin.storage.from("audio").createSignedUrl(path, 60 * 60 * 6);
            return data?.signedUrl ?? null;
          };
          const loadSources = async (): Promise<{ facts: string[]; sources: Source[] }> => {
            const { data } = await supabaseAdmin
              .from("artwork_facts")
              .select("label, source_url, source_title")
              .eq("artwork_id", artworkId)
              .order("sort_order");
            return {
              facts: (data ?? []).map((f) => f.label),
              sources: (data ?? []).map((f) => ({
                title: f.source_title ?? f.label.slice(0, 80),
                url: f.source_url,
              })),
            };
          };

          // a) cache
          const { data: cached } = await supabaseAdmin
            .from("artwork_guides")
            .select("script_text, audio_path")
            .eq("artwork_id", artworkId)
            .eq("language", language)
            .maybeSingle();
          // Narration with audio is final; narration without audio retries the voice below.
          if (cached?.audio_path) {
            const { sources } = await loadSources();
            return Response.json({
              ok: true,
              script_text: cached.script_text,
              audio_url: await sign(cached.audio_path),
              sources,
            });
          }

          const { data: art } = await supabaseAdmin
            .from("artifacts")
            .select("id, title, artist, year, description, museums(name)")
            .eq("id", artworkId)
            .maybeSingle();
          if (!art) return fail("Artwork not found", 404);
          const museumName = (art.museums as { name: string } | null)?.name ?? "";

          // b) facts, only when none exist yet
          let { facts, sources } = await loadSources();
          if (facts.length === 0) {
            const rows: { label: string; source_url: string | null; source_title: string | null }[] = [];
            const keenKey = process.env["KEENABLE_API_KEY"];
            if (keenKey) {
              try {
                const hits = await g.keenableSearch(keenKey, `${art.title} ${art.artist} Louvre`, 6);
                for (const h of hits.slice(0, 4)) {
                  rows.push({ label: h.snippet, source_url: h.url, source_title: h.title });
                }
              } catch (e) {
                console.error("[artwork-guide] Keenable failed, continuing with description:", e);
              }
            }
            if (art.description?.trim()) {
              rows.push({ label: art.description.trim(), source_url: null, source_title: "Musée du Louvre" });
            }
            if (rows.length) {
              await supabaseAdmin
                .from("artwork_facts")
                .insert(rows.map((r, i) => ({ ...r, artwork_id: artworkId, sort_order: i })));
              ({ facts, sources } = await loadSources());
            }
          }

          // c) narration in the target language
          const aiKey = process.env["LOVABLE_API_KEY"];
          if (!aiKey) return fail("AI is not configured");
          const factList = facts.length
            ? facts
            : [`"${art.title}"${art.artist ? ` by ${art.artist}` : ""}${art.year ? `, ${art.year}` : ""}${museumName ? `, shown at ${museumName}` : ""}.`];
          const script =
            cached?.script_text ?? (await g.writeNarration(aiKey, art, factList, g.languageName(language)));

          // d+e) speech, upload, cache
          let audioPath: string | null = null;
          let ttsError: string | undefined;
          try {
            const elKey = process.env["ELEVENLABS_API_KEY"];
            if (!elKey) throw new Error("ElevenLabs is not connected");
            const voice = process.env["ELEVENLABS_VOICE_ID"] || g.DEFAULT_VOICE_ID;
            const mp3 = await g.elevenTts(elKey, voice, script);
            const path = `guides/${artworkId}/${language}.mp3`;
            const up = await supabaseAdmin.storage
              .from("audio")
              .upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
            if (up.error) throw new Error(up.error.message);
            audioPath = path;
          } catch (e) {
            ttsError = e instanceof Error ? e.message : "Voice generation failed";
            console.error("[artwork-guide] TTS failed:", ttsError);
          }

          await supabaseAdmin
            .from("artwork_guides")
            .upsert(
              { artwork_id: artworkId, language, script_text: script, audio_path: audioPath },
              { onConflict: "artwork_id,language" },
            );

          return Response.json({
            ok: true,
            script_text: script,
            audio_url: await sign(audioPath),
            sources,
            ...(ttsError ? { tts_error: ttsError } : {}),
          });
        } catch (e) {
          console.error("[artwork-guide]", e);
          return fail(e instanceof Error ? e.message : "Guide generation failed", 502);
        }
      },
    },
  },
});
