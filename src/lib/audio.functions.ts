import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lang } from "@/lib/languages";

export const generateStopAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { stopId: string; language: string }) => {
    if (!d?.stopId || !/^[a-z]{2}$/.test(d.language)) throw new Error("Invalid input");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: stop, error } = await supabase
      .from("stops")
      .select("*, museums(*)")
      .eq("id", data.stopId)
      .single();
    if (error || !stop || !stop.museums || stop.museums.owner_id !== userId) {
      throw new Error("You can't edit this stop");
    }
    if (!stop.body.trim()) throw new Error("Write the text of this stop first");

    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) throw new Error("AI is not configured");
    const { translateStop, synthesize } = await import("@/lib/ai.server");

    const museum = stop.museums;
    let title = stop.title;
    let body = stop.body;
    if (data.language !== museum.source_language) {
      const t = await translateStop(
        apiKey,
        { title, body },
        lang(museum.source_language).english,
        lang(data.language).english,
      );
      title = t.title;
      body = t.body;
    }

    const wav = await synthesize(apiKey, `${title}.\n\n${body}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${museum.id}/${stop.id}/${data.language}.wav`;
    const up = await supabaseAdmin.storage
      .from("audio")
      .upload(path, wav, { contentType: "audio/wav", upsert: true });
    if (up.error) throw new Error(up.error.message);

    const { error: dbErr } = await supabaseAdmin.from("stop_audio").upsert(
      {
        stop_id: stop.id,
        museum_id: museum.id,
        language: data.language,
        title,
        body,
        audio_url: path,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stop_id,language" },
    );
    if (dbErr) throw new Error(dbErr.message);
    return { ok: true };
  });
