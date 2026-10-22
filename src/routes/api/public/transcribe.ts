import { createFileRoute } from "@tanstack/react-router";

// Public visitor endpoint: short voice clip (webm / mp4 / m4a) → text via ElevenLabs.
const MAX_BYTES = 5 * 1024 * 1024;

export const Route = createFileRoute("/api/public/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData().catch(() => null);
          const file = form?.get("file");
          if (!(file instanceof Blob) || file.size === 0) {
            return Response.json({ ok: false, error: "No audio received" }, { status: 400 });
          }
          if (file.size > MAX_BYTES) {
            return Response.json({ ok: false, error: "Recording too long" }, { status: 413 });
          }
          const type = file.type.split(";")[0] ?? "";
          if (type && !/^(audio|video)\/(webm|mp4|m4a|x-m4a|aac|mpeg|ogg|wav)$/.test(type)) {
            return Response.json({ ok: false, error: "Unsupported audio format" }, { status: 415 });
          }
          const apiKey = process.env["ELEVENLABS_API_KEY"];
          if (!apiKey) return Response.json({ ok: false, error: "Voice input is not configured" });
          const ext = type.includes("webm") ? "webm" : type.includes("ogg") ? "ogg" : "m4a";
          const { elevenStt } = await import("@/lib/guide.server");
          const out = await elevenStt(apiKey, file, `clip.${ext}`);
          return Response.json({ ok: true, ...out });
        } catch (e) {
          console.error("[transcribe]", e);
          return Response.json({ ok: false, error: "Transcription failed" }, { status: 502 });
        }
      },
    },
  },
});
