import { createFileRoute } from "@tanstack/react-router";

// Integration health check. Returns booleans + short messages only (never key values).
type Check = { ok: boolean; message: string };

async function check(fn: () => Promise<unknown>): Promise<Check> {
  try {
    await fn();
    return { ok: true, message: "ok" };
  } catch (e) {
    return { ok: false, message: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const g = await import("@/lib/guide.server");
        const need = (name: string) => {
          const v = process.env[name];
          if (!v) throw new Error(`${name} is not set`);
          return v;
        };
        const [elevenlabs_tts, elevenlabs_stt, keenable, llm, storage, elevenlabs_agent] = await Promise.all([
          check(() =>
            g.elevenTts(need("ELEVENLABS_API_KEY"), process.env["ELEVENLABS_VOICE_ID"] || g.DEFAULT_VOICE_ID, "Hello"),
          ),
          check(() => g.elevenUser(need("ELEVENLABS_API_KEY"))),
          check(() => g.keenableSearch(need("KEENABLE_API_KEY"), "Mona Lisa", 1)),
          check(() => g.sayOk(need("LOVABLE_API_KEY"))),
          check(async () => {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error } = await supabaseAdmin.storage.from("audio").list("", { limit: 1 });
            if (error) throw new Error(error.message);
          }),
          check(() => g.elevenAgent(need("ELEVENLABS_API_KEY"), need("ELEVENLABS_AGENT_ID"))),
        ]);
        return Response.json(
          { elevenlabs_tts, elevenlabs_stt, keenable, llm, storage, elevenlabs_agent },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
