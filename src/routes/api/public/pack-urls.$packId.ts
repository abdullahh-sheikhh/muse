import { createFileRoute } from "@tanstack/react-router";

// Public visitor endpoint: signs every audio file in a ready pack so the
// browser can download them into its cache for offline listening.
export const Route = createFileRoute("/api/public/pack-urls/$packId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/.test(params.packId)) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: pack } = await supabaseAdmin
          .from("audio_packs")
          .select("id, language, manifest")
          .eq("id", params.packId)
          .eq("status", "ready")
          .maybeSingle();
        if (!pack) return Response.json({ error: "Not found" }, { status: 404 });

        const entries = Array.isArray(pack.manifest) ? pack.manifest : [];
        const files: { ref: string; url: string }[] = [];
        for (const entry of entries) {
          const e = entry as { ref?: string; audio_path?: string };
          if (!e?.ref || !e?.audio_path) continue;
          const { data: signed } = await supabaseAdmin.storage
            .from("audio")
            .createSignedUrl(e.audio_path, 60 * 60 * 6);
          if (signed) files.push({ ref: e.ref, url: signed.signedUrl });
        }
        return Response.json(
          { language: pack.language, files },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
